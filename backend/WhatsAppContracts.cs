using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

public static class WhatsAppContracts
{
    public static string ValidatePhone(string? value)
    {
        if (value?.Length > 64) throw new ApiException(400, "Numéro WhatsApp trop long.");
        var phone = Regex.Replace(value?.Trim() ?? "", @"[\s().-]", "");
        if (phone.StartsWith("00")) phone = "+" + phone[2..];
        if (!Regex.IsMatch(phone, @"^\+[1-9]\d{7,14}$")) throw new ApiException(400, "Indiquez le numéro WhatsApp avec l’indicatif du pays, par exemple +212612345678.");
        return phone;
    }

    private static ITimeLimitedDataProtector Protector(IServiceProvider services) => services.GetRequiredService<IDataProtectionProvider>().CreateProtector("ContractShare.v1").ToTimeLimitedDataProtector();

    public static void MapSharedContracts(this WebApplication app)
    {
        app.MapPost("/api/admin/bookings/{id:int}/whatsapp/manual", async (int id, AppDbContext db) => {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(91502, {id})");
            var booking = await RentalRules.Full(db).FirstOrDefaultAsync(b => b.Id == id) ?? throw new ApiException(404, "Réservation introuvable.");
            if (booking.Status is not ("Confirmed" or "Active" or "Completed")) throw new ApiException(409, "Acceptez d’abord la demande du client. Les contrats annulés ne peuvent pas être envoyés.");
            if (!booking.WhatsAppConsent || string.IsNullOrWhiteSpace(booking.ContactWhatsApp)) throw new ApiException(409, "Le client doit renseigner son numéro et autoriser l’envoi WhatsApp dans sa réservation.");
            var phone = ValidatePhone(booking.ContactWhatsApp);
            var message = $"Bonjour {booking.User.FullName}, votre réservation {booking.Reference} chez Location Ennour est acceptée.\nVéhicule : {booking.Vehicle.Brand} {booking.Vehicle.Model}\nDu {booking.StartDate:dd/MM/yyyy} au {booking.EndDate:dd/MM/yyyy} ({booking.Days} jours)\nDépart : {booking.PickupLocation.Name}\nRetour : {booking.ReturnLocation.Name}\nTotal : {booking.Total:0.00} MAD · Caution séparée : {booking.Deposit:0.00} MAD.\nJe vous transmets votre contrat en pièce jointe. Merci de vérifier les informations.";
            if (booking.ContractEmailStatus is not ("Sent" or "AcceptedByProvider")) {
                booking.ContractEmailStatus = "ManualPrepared";
                booking.ContractEmailNextAttemptAt = null;
                await db.SaveChangesAsync();
            }
            await tx.CommitAsync();
            return Results.Ok(new { phone, message, whatsappUrl = "https://wa.me/" + phone.TrimStart('+') + "?text=" + Uri.EscapeDataString(message) });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        app.MapGet("/api/contracts/shared/{token}", async (string token, AppDbContext db, HttpContext http, IServiceProvider services) => {
            if (token.Length > 2048) return Results.NotFound();
            int id;
            try { if (!int.TryParse(Protector(services).Unprotect(token), out id)) return Results.NotFound(); }
            catch (CryptographicException) { return Results.NotFound(); }
            var booking = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id);
            if (booking is null || booking.Status is not ("Confirmed" or "Active" or "Completed") || booking.ContractEmailHtml is null) return Results.NotFound();
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
            http.Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            http.Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'";
            return Results.Content(booking.ContractEmailHtml, "text/html; charset=utf-8");
        }).RequireRateLimiting("ai");
    }

    public static async Task Dispatch(Booking b, IConfiguration config, IServiceProvider services, IHostEnvironment environment, CancellationToken token)
    {
        if (config["WhatsApp:DeliveryMode"] != "n8n") {
            b.ContractEmailStatus = "ManualRequired";
            b.ContractEmailNextAttemptAt = null;
            return;
        }
        bool SafeUrl(string? value, out Uri uri) {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var parsed)) { uri = null!; return false; }
            uri = parsed;
            return string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Fragment) && (uri.Scheme == "https" || environment.IsDevelopment() && uri.Scheme == "http" && uri.IsLoopback);
        }
        if (!SafeUrl(config["WhatsApp:WebhookUrl"], out var webhook) || !SafeUrl(config["WhatsApp:PublicBaseUrl"], out var publicBase)
            || publicBase.AbsolutePath != "/" || !string.IsNullOrEmpty(publicBase.Query)
            || config["WhatsApp:WebhookKey"]?.Length < 32 || string.IsNullOrWhiteSpace(config["WhatsApp:WebhookKey"])) {
            b.ContractEmailStatus = "WaitingConfiguration";
            b.ContractEmailNextAttemptAt = DateTime.UtcNow.AddMinutes(1);
            return;
        }
        if (!b.WhatsAppConsent || string.IsNullOrWhiteSpace(b.ContractEmailHtml)) { b.ContractEmailStatus = "Failed"; return; }
        var share = Protector(services).Protect(b.Id.ToString(), TimeSpan.FromDays(7));
        var url = publicBase.ToString().TrimEnd('/') + "/api/contracts/shared/" + Uri.EscapeDataString(share);
        b.ContractEmailAttempts++;
        // Do not automatically retry an ambiguous network failure: Meta may already have accepted it.
        try {
            using var request = new HttpRequestMessage(HttpMethod.Post, webhook);
            request.Headers.Add("X-Ennour-Webhook-Key", config["WhatsApp:WebhookKey"]);
            request.Headers.Add("Idempotency-Key", "ennour-contract-" + b.Reference);
            request.Content = JsonContent.Create(new {
                eventId = "ennour-contract-" + b.Reference, eventType = "rental.approved", bookingId = b.Id,
                reference = b.Reference, to = ValidatePhone(b.ContactWhatsApp).TrimStart('+'), consent = b.WhatsAppConsent,
                contractUrl = url, linkExpiresInDays = 7
            });
            using var response = await services.GetRequiredService<IHttpClientFactory>().CreateClient("n8n").SendAsync(request, token);
            if (!response.IsSuccessStatusCode) { b.ContractEmailStatus = (int)response.StatusCode >= 500 ? "Uncertain" : "Failed"; return; }
            var acknowledgement = await response.Content.ReadFromJsonAsync<DispatchResult>(token);
            if (acknowledgement?.Status != "accepted" || acknowledgement.MessageId?.StartsWith("wamid.") != true) {
                b.ContractEmailStatus = "Uncertain"; return;
            }
            b.WhatsAppMessageId = acknowledgement.MessageId;
            b.ContractEmailStatus = "AcceptedByProvider";
            b.ContractEmailSentAt = DateTime.UtcNow;
            b.ContractEmailNextAttemptAt = null;
        }
        catch (Exception) when (!token.IsCancellationRequested) { b.ContractEmailStatus = "Uncertain"; }
    }

    private sealed record DispatchResult(string Status, string MessageId);
}
