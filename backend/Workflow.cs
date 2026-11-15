using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

public static class Workflow
{
    public static void MapWorkflow(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(p => p.RequireRole("Admin"));
        admin.MapPost("/bookings/{id:int}/review", async (int id, ReviewInput input, AppDbContext db, BookingEvents events) =>
        {
            var vehicleId = await db.Bookings.Where(b => b.Id == id).Select(b => (int?)b.VehicleId).FirstOrDefaultAsync() ?? throw new ApiException(404, "Demande introuvable.");
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({vehicleId})");
            var booking = await RentalRules.Full(db).FirstAsync(b => b.Id == id);
            if (booking.Status != "Pending") throw new ApiException(409, "Cette demande a déjà été traitée.");
            if (input.Approve)
            {
                RentalRules.Dates(booking.StartDate, booking.EndDate);
                if (booking.Vehicle.Archived || booking.Vehicle.Status != "Available") throw new ApiException(409, "Le véhicule n’est plus disponible.");
                if (await db.Bookings.AnyAsync(b => b.Id != id && b.VehicleId == vehicleId && (b.Status == "Pending" || b.Status == "Confirmed" || b.Status == "Active") && b.StartDate < booking.EndDate && b.EndDate > booking.StartDate)) throw new ApiException(409, "Une autre réservation est déjà confirmée sur cette période.");
            }
            if (input.Note?.Length > 1000) throw new ApiException(400, "Le motif est limité à 1000 caractères.");
            booking.Status = input.Approve ? "Confirmed" : "Rejected";
            if (!input.Approve && booking.PaymentStatus == "TestPaid") booking.PaymentStatus = "TestRefunded";
            booking.ReviewNote = input.Note?.Trim() ?? "";
            await db.SaveChangesAsync(); await tx.CommitAsync();
            await events.Notify(booking, input.Approve ? "Réservation acceptée" : "Demande refusée — remboursement test si applicable");
            return RentalRules.Dto(booking);
        });

        admin.MapPost("/locations", async (Location input, AppDbContext db) =>
        {
            ValidateLocation(input);
            var location = new Location { Name = input.Name.Trim(), City = input.City, Address = input.Address.Trim(), Latitude = input.Latitude, Longitude = input.Longitude, Phone = input.Phone.Trim() };
            db.Locations.Add(location); await db.SaveChangesAsync();
            return Results.Created($"/api/locations/{location.Id}", location);
        });
        admin.MapPut("/locations/{id:int}", async (int id, Location input, AppDbContext db) =>
        {
            ValidateLocation(input);
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(91501, {id})");
            var location = await db.Locations.FindAsync(id) ?? throw new ApiException(404, "Agence introuvable.");
            if (location.City != input.City && await db.Bookings.AnyAsync(b => (b.PickupLocationId == id || b.ReturnLocationId == id) && (b.Status == "Pending" || b.Status == "Confirmed" || b.Status == "Active"))) throw new ApiException(409, "La ville ne peut pas changer avec des demandes ou locations en cours.");
            location.Name = input.Name.Trim(); location.City = input.City; location.Address = input.Address.Trim(); location.Phone = input.Phone.Trim(); location.Latitude = input.Latitude; location.Longitude = input.Longitude;
            await db.SaveChangesAsync(); await tx.CommitAsync(); return location;
        });
        admin.MapDelete("/locations/{id:int}", async (int id, AppDbContext db) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(91501, {id})");
            var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == id) ?? throw new ApiException(404, "Agence introuvable.");
            if (await db.Bookings.AnyAsync(b => (b.PickupLocationId == id || b.ReturnLocationId == id) && (b.Status == "Pending" || b.Status == "Confirmed" || b.Status == "Active"))) throw new ApiException(409, "Ce bureau est utilisé par des demandes ou locations en cours. Traitez ces demandes avant de le supprimer.");
            location.Archived = true;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.NoContent();
        });

        app.MapGet("/api/payments/config", (IConfiguration cfg) => new { mode = cfg.GetValue("Payments:TestEnabled", true) && app.Environment.IsDevelopment() ? "test" : "unavailable", currency = "MAD" });
        app.MapPost("/api/bookings/{id:int}/test-payment", () => Results.Json(new { message = "Le paiement doit maintenant être effectué dans le formulaire avant l’envoi de la demande." }, statusCode: 410)).RequireAuthorization();
    }

    static void ValidateLocation(Location input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 120 || string.IsNullOrWhiteSpace(input.Address) || input.Address.Length > 300 || string.IsNullOrWhiteSpace(input.Phone) || input.Phone.Length > 30) throw new ApiException(400, "Nom, adresse et téléphone sont obligatoires (120/300/30 caractères maximum).");
        if (input.City is not ("Casablanca" or "Rabat" or "Marrakech" or "Agadir")) throw new ApiException(400, "Choisissez une ville desservie.");
        if (!double.IsFinite(input.Latitude) || !double.IsFinite(input.Longitude) || input.Latitude < -90 || input.Latitude > 90 || input.Longitude < -180 || input.Longitude > 180) throw new ApiException(400, "Coordonnées GPS invalides.");
    }
}
