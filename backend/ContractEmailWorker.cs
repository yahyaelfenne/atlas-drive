using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

public sealed class ContractEmailWorker(IServiceScopeFactory scopes, IConfiguration config, IHostEnvironment environment, ILogger<ContractEmailWorker> logger, IServiceProvider services) : BackgroundService
{
    public static string ValidateEmail(string? value)
    {
        var email = value?.Trim() ?? "";
        if (email.Length > 254 || email.Contains('\r') || email.Contains('\n') || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !email.Contains('@'))
            throw new ApiException(400, "Indiquez une adresse e-mail valide pour recevoir votre contrat.");
        return email;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await Deliver(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Contract email queue temporarily unavailable; retrying."); }
            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task Deliver(CancellationToken token)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var ids = await db.Bookings.AsNoTracking()
            .Where(b => (b.ContractEmailStatus == "Pending" || b.ContractEmailStatus == "WaitingConfiguration") && (b.ContractEmailNextAttemptAt == null || b.ContractEmailNextAttemptAt <= now))
            .OrderBy(b => b.Id).Select(b => b.Id).Take(10).ToListAsync(token);
        foreach (var id in ids)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(token);
            // A separate lock namespace protects the queue across API instances.
            var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock(91502, {id}) AS \"Value\"").SingleAsync(token);
            if (!locked) { await transaction.RollbackAsync(token); continue; }
            db.ChangeTracker.Clear();
            var booking = await db.Bookings.SingleAsync(b => b.Id == id, token);
            if (booking.ContractEmailStatus is not ("Pending" or "WaitingConfiguration")) continue;
            if (booking.Status is "Cancelled" or "Rejected") {
                booking.ContractEmailStatus = "Cancelled";
            }
            else if (booking.ContractDeliveryChannel == "whatsapp") {
                await WhatsAppContracts.Dispatch(booking, config, services, environment, token);
            }
            else if (string.IsNullOrWhiteSpace(config["Smtp:Host"]) && !(environment.IsDevelopment() && !string.IsNullOrWhiteSpace(config["Smtp:PickupDirectory"]))) {
                booking.ContractEmailStatus = "WaitingConfiguration";
                booking.ContractEmailNextAttemptAt = now.AddMinutes(1);
            }
            else {
                booking.ContractEmailAttempts++;
                try {
                    using var mail = CreateMessage(booking, config["Smtp:From"] ?? "reservations@location-ennour.test");
                    using var smtp = new SmtpClient(config["Smtp:Host"] ?? "localhost", config.GetValue("Smtp:Port", 587)) {
                        EnableSsl = config.GetValue("Smtp:EnableSsl", true), Timeout = 15000
                    };
                    if (environment.IsDevelopment() && !string.IsNullOrWhiteSpace(config["Smtp:PickupDirectory"])) {
                        Directory.CreateDirectory(config["Smtp:PickupDirectory"]!);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
                        smtp.PickupDirectoryLocation = config["Smtp:PickupDirectory"]!;
                        smtp.EnableSsl = false;
                    }
                    if (!string.IsNullOrWhiteSpace(config["Smtp:Username"])) smtp.Credentials = new NetworkCredential(config["Smtp:Username"], config["Smtp:Password"]);
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                    timeout.CancelAfter(TimeSpan.FromSeconds(15));
                    await smtp.SendMailAsync(mail, timeout.Token);
                    booking.ContractEmailStatus = "Sent";
                    booking.ContractEmailSentAt = DateTime.UtcNow;
                    booking.ContractEmailNextAttemptAt = null;
                }
                catch (Exception) when (!token.IsCancellationRequested) {
                    booking.ContractEmailStatus = booking.ContractEmailAttempts >= 5 ? "Failed" : "Pending";
                    booking.ContractEmailNextAttemptAt = DateTime.UtcNow.AddMinutes(Math.Min(30, Math.Pow(2, booking.ContractEmailAttempts)));
                    logger.LogWarning("Contract email attempt failed for booking {BookingId}; recorded for retry.", id);
                }
            }
            await db.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
        }
    }

    public static MailMessage CreateMessage(Booking booking, string sender)
    {
        var html = booking.ContractEmailHtml ?? throw new InvalidOperationException("Missing approved contract snapshot.");
        var mail = new MailMessage(sender, ValidateEmail(booking.ContactEmail)) {
            Subject = $"Location Ennour — votre contrat {booking.Reference}",
            SubjectEncoding = Encoding.UTF8, BodyEncoding = Encoding.UTF8, IsBodyHtml = true,
            Body = html.Replace("<button onclick='window.print()'>Imprimer / Enregistrer en PDF</button>", "")
        };
        mail.Attachments.Add(Attachment.CreateAttachmentFromString(html, $"Contrat-{booking.Reference}.html", Encoding.UTF8, "text/html"));
        return mail;
    }
}
