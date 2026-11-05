using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AtlasDrive.Api;

[Authorize(Roles = "Admin")]
public class NotificationsHub : Hub;

public static class RentalRules
{
    public static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Africa/Casablanca")));
    public static void Dates(DateOnly start, DateOnly end, bool allowPast = false)
    {
        if ((!allowPast && start < Today) || end <= start || end.DayNumber - start.DayNumber > 365)
            throw new ApiException(400, "Choisissez une date de départ à partir d’aujourd’hui et une durée de 1 à 365 jours.");
    }
    public static PriceQuote Quote(Vehicle vehicle, QuoteInput input)
    {
        Dates(input.StartDate, input.EndDate);
        if (input.Insurance is not ("basic" or "premium")) throw new ApiException(400, "Assurance invalide.");
        int days = input.EndDate.DayNumber - input.StartDate.DayNumber;
        decimal rental = days * vehicle.DailyRate;
        decimal insurance = input.Insurance == "premium" ? 90m * days : 0;
        decimal extras = ((input.ChildSeat ? 35m : 0) + (input.AdditionalDriver ? 50m : 0)) * days;
        return new(days, vehicle.DailyRate, rental, insurance, extras, rental + insurance + extras, vehicle.Deposit);
    }
    public static void Vehicle(Vehicle v)
    {
        if (string.IsNullOrWhiteSpace(v.Brand) || string.IsNullOrWhiteSpace(v.Model) || v.Brand.Length > 70 || v.Model.Length > 90 || v.Description is null || v.Description.Length > 2000 || v.ImageUrl is null)
            throw new ApiException(400, "La marque et le modèle sont obligatoires (70/90 caractères maximum).");
        if (v.Category is not ("Citadine" or "SUV" or "Berline" or "Premium") || v.Transmission is not ("Automatique" or "Manuelle") || v.Fuel is not ("Essence" or "Diesel" or "Hybride" or "Électrique"))
            throw new ApiException(400, "Catégorie, transmission ou carburant invalide.");
        if (v.Status is not ("Available" or "Maintenance") || v.Seats < 2 || v.Seats > 9 || v.Year < 2000 || v.Year > DateTime.UtcNow.Year + 1 || v.DailyRate < 50 || v.DailyRate > 100000 || v.Deposit < 0 || v.Deposit > 1000000)
            throw new ApiException(400, "Vérifiez le statut, l’année, les places, le tarif et la caution.");
        if (v.City is not ("Casablanca" or "Rabat" or "Marrakech" or "Agadir")) throw new ApiException(400, "Ville non desservie.");
        if (!string.IsNullOrEmpty(v.ImageUrl) && !(v.ImageUrl.StartsWith("/assets/", StringComparison.Ordinal) || (Uri.TryCreate(v.ImageUrl, UriKind.Absolute, out var uri) && uri.Scheme == "https")))
            throw new ApiException(400, "L’image doit être une URL HTTPS ou un fichier /assets/.");
        if (v.Features is null || v.Features.Length > 20 || v.Features.Any(f => f is null || f.Length > 100)) throw new ApiException(400, "Équipements invalides.");
    }
    public static BookingDto Dto(Booking b) => new(b.Id, b.Reference, b.VehicleId, b.Vehicle.Brand + " " + b.Vehicle.Model, b.Vehicle.ImageUrl, b.User.FullName, b.User.Email ?? "", b.StartDate, b.EndDate, b.PickupLocation.Name, b.ReturnLocation.Name, b.Days, b.DailyRate, b.Total, b.Deposit, b.Status, b.CreatedAt, b.ReturnedAt, b.ReturnNotes, b.DamageFee);
    public static IQueryable<Booking> Full(AppDbContext db) => db.Bookings.IgnoreQueryFilters().Include(b => b.Vehicle).Include(b => b.User).Include(b => b.PickupLocation).Include(b => b.ReturnLocation);
    public static string UserId(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new ApiException(401, "Connexion requise.");
    public static void Own(Booking b, ClaimsPrincipal user)
    { if (b.UserId != UserId(user) && !user.IsInRole("Admin")) throw new ApiException(403, "Accès refusé à cette réservation."); }
}

public class TokenService(IConfiguration config, UserManager<AppUser> users)
{
    public async Task<object> Issue(AppUser user)
    {
        var roles = await users.GetRolesAsync(user);
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, user.Id), new(ClaimTypes.Name, user.FullName), new(ClaimTypes.Email, user.Email!), new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var token = new JwtSecurityToken(issuer: config["Jwt:Issuer"] ?? "AtlasDrive", audience: config["Jwt:Audience"] ?? "AtlasDrive", claims: claims, expires: DateTime.UtcNow.AddHours(8), signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new { token = new JwtSecurityTokenHandler().WriteToken(token), user = new { user.Id, user.FullName, user.Email, role = roles.Contains("Admin") ? "Admin" : "Customer" } };
    }
}

public class BookingEvents(AppDbContext db, IHubContext<NotificationsHub> hub, IConfiguration config, ILogger<BookingEvents> logger)
{
    public async Task Notify(Booking b, string title)
    {
        var note = new Notification { Title = title, Message = $"{b.Reference} · {b.User.FullName} · {b.Vehicle.Brand} {b.Vehicle.Model}" };
        db.Notifications.Add(note);
        await db.SaveChangesAsync();
        try { await hub.Clients.All.SendAsync("BookingChanged", new { b.Id, b.Reference, b.Status, title }); }
        catch (Exception ex) { logger.LogWarning(ex, "SignalR notification failed for {Reference}", b.Reference); }
        if (string.IsNullOrWhiteSpace(config["Smtp:Host"])) return;
        try
        {
            using var smtp = new SmtpClient(config["Smtp:Host"], config.GetValue("Smtp:Port", 587)) { EnableSsl = config.GetValue("Smtp:EnableSsl", true), Timeout = 10000 };
            if (!string.IsNullOrWhiteSpace(config["Smtp:Username"])) smtp.Credentials = new NetworkCredential(config["Smtp:Username"], config["Smtp:Password"]);
            using var mail = new MailMessage(config["Smtp:From"] ?? "reservations@atlasdrive.ma", b.User.Email!) { Subject = $"Atlas Drive — {title} {b.Reference}", Body = $"Bonjour {b.User.FullName},\n\n{title} : {b.Reference}\n{b.Vehicle.Brand} {b.Vehicle.Model}\nDu {b.StartDate:dd/MM/yyyy} au {b.EndDate:dd/MM/yyyy}\nTotal : {b.Total:0.00} MAD\nStatut : {b.Status}\n\nVotre équipe Atlas Drive" };
            await smtp.SendMailAsync(mail);
        }
        catch (Exception ex) { logger.LogWarning(ex, "SMTP unavailable; booking {Reference} remains saved", b.Reference); }
    }
}

public static class RentalContract
{
    public static string Html(Booking b)
    {
        string H(object? value) => WebUtility.HtmlEncode(Convert.ToString(value, CultureInfo.InvariantCulture) ?? "");
        string Row(string label, object? value) => $"<tr><th>{H(label)}</th><td>{H(value)}</td></tr>";
        return "<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>Contrat " + H(b.Reference) + "</title><style>body{font:15px/1.7 system-ui;color:#173d32;max-width:850px;margin:45px auto;padding:24px}h1{font-size:32px}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px}th{width:40%}button{background:#173d32;color:white;padding:12px 24px;border:0;border-radius:7px}small{color:#666}@media print{button{display:none}body{margin:0}}</style></head><body><small>ATLAS DRIVE · LOCATION DE VOITURES</small><h1>Contrat de location</h1><p>Référence <strong>" + H(b.Reference) + "</strong> · " + H(b.Status) + "</p><table>" + Row("Locataire", b.User.FullName) + Row("Email", b.User.Email) + Row("Véhicule", b.Vehicle.Brand + " " + b.Vehicle.Model + " · " + b.Vehicle.Year) + Row("Départ", b.StartDate.ToString("dd/MM/yyyy") + " · " + b.PickupLocation.Name) + Row("Retour prévu", b.EndDate.ToString("dd/MM/yyyy") + " · " + b.ReturnLocation.Name) + Row("Durée", b.Days + " jour(s)") + Row("Tarif journalier", b.DailyRate.ToString("0.00") + " MAD") + Row("Assurance", b.Insurance == "premium" ? "Premium : 90 MAD/jour" : "Basic incluse") + Row("Options", (b.ChildSeat ? "Siège enfant : 35 MAD/jour. " : "") + (b.AdditionalDriver ? "Conducteur additionnel : 50 MAD/jour." : "")) + Row("Montant de location", b.Total.ToString("0.00") + " MAD") + Row("Caution remboursable (hors total)", b.Deposit.ToString("0.00") + " MAD") + Row("Frais de dommages au retour", b.DamageFee.ToString("0.00") + " MAD") + Row("Kilométrage départ / retour", $"{b.CheckoutOdometer?.ToString() ?? "À relever"} / {b.ReturnOdometer?.ToString() ?? "À relever"}") + Row("Observations", b.Notes) + Row("État du retour", b.ReturnNotes) + "</table><h2>Conditions de location</h2><p>Permis de conduire valide et pièce d’identité à présenter à l’agence. La caution est distincte du prix de location et est restituée après contrôle du véhicule, sous réserve des montants justifiés. Le carburant doit être remis au niveau de départ. Tout incident ou retard doit être signalé à l’agence. Les options et frais sont indiqués ci-dessus.</p><p>Ce document est un contrat de démonstration à compléter et faire valider par les parties avant utilisation commerciale.</p><p style='margin-top:50px'>Signature du locataire : ____________________ &nbsp; Signature agence : ____________________</p><button onclick='window.print()'>Imprimer / Enregistrer en PDF</button></body></html>";
    }
}
