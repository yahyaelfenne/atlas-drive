using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

public static class SeedData
{
    public static async Task Run(IServiceProvider services, bool development)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        if (!development) return;
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        foreach (var role in new[] { "Admin", "Customer" }) if (!await roles.RoleExistsAsync(role)) await roles.CreateAsync(new(role));
        async Task<AppUser> User(string key, string email, string password, string name, string role)
        {
            email = config[$"Seed:{key}Email"] ?? email;
            var user = await users.FindByEmailAsync(email);
            if (user is null)
            {
                user = new() { UserName = email, Email = email, FullName = name, EmailConfirmed = true, PhoneNumber = "+212600000000" };
                var result = await users.CreateAsync(user, config[$"Seed:{key}Password"] ?? password);
                if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }
            if (!await users.IsInRoleAsync(user, role)) await users.AddToRoleAsync(user, role);
            return user;
        }
        await User("Admin", "admin@atlasdrive.ma", "AtlasAdmin2026!", "Admin Atlas Drive", "Admin");
        var customer = await User("Customer", "client@atlasdrive.ma", "AtlasClient2026!", "Yassine Amrani", "Customer");
        if (!await db.Locations.AnyAsync())
        {
            db.Locations.AddRange(
                new Location { Name = "Casablanca · Centre", City = "Casablanca", Address = "Boulevard d’Anfa, Casablanca", Latitude = 33.5926, Longitude = -7.6341, Phone = "+212 522 00 00 00" },
                new Location { Name = "Marrakech · Aéroport", City = "Marrakech", Address = "Aéroport Marrakech Ménara", Latitude = 31.6069, Longitude = -8.0363, Phone = "+212 524 00 00 00" },
                new Location { Name = "Rabat · Agdal", City = "Rabat", Address = "Avenue de France, Agdal, Rabat", Latitude = 34.0012, Longitude = -6.8498, Phone = "+212 537 00 00 00" },
                new Location { Name = "Agadir · Centre", City = "Agadir", Address = "Avenue Mohammed V, Agadir", Latitude = 30.4204, Longitude = -9.5981, Phone = "+212 528 00 00 00" });
            await db.SaveChangesAsync();
        }
        if (!await db.Vehicles.IgnoreQueryFilters().AnyAsync())
        {
            Vehicle Car(string brand, string model, string cat, decimal rate, string city, string image, string fuel = "Essence", string transmission = "Automatique", int seats = 5) => new() { Brand = brand, Model = model, Year = 2025, Category = cat, DailyRate = rate, Deposit = cat == "Premium" ? 15000 : cat == "SUV" ? 7000 : 4000, City = city, ImageUrl = image, Fuel = fuel, Transmission = transmission, Seats = seats, Features = ["Climatisation", "Bluetooth", "USB", "Kilométrage illimité"], Description = $"Découvrez le Maroc au volant de la {brand} {model}. Confort, sérénité et liberté pour chacun de vos trajets.", Rating = 4.9m };
            db.Vehicles.AddRange(
                Car("Renault", "Clio", "Citadine", 290, "Casablanca", "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1000&q=85", transmission: "Manuelle"),
                Car("Dacia", "Duster", "SUV", 450, "Marrakech", "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=85", "Diesel"),
                Car("Volkswagen", "Golf 8", "Berline", 550, "Casablanca", "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=85"),
                Car("Mercedes-Benz", "Classe C", "Premium", 1100, "Casablanca", "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1000&q=85", "Diesel"),
                Car("Hyundai", "Tucson", "SUV", 650, "Agadir", "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?auto=format&fit=crop&w=1000&q=85", "Hybride"),
                Car("Peugeot", "208", "Citadine", 320, "Rabat", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&q=85", transmission: "Manuelle"),
                Car("BMW", "Série 3", "Premium", 1050, "Marrakech", "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1000&q=85", "Diesel"),
                Car("Toyota", "Corolla", "Berline", 490, "Rabat", "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=85", "Hybride"));
            await db.SaveChangesAsync();
        }
        if (!await db.Bookings.AnyAsync())
        {
            var cars = await db.Vehicles.OrderBy(v => v.Id).ToListAsync();
            var loc = await db.Locations.OrderBy(l => l.Id).FirstAsync();
            var today = RentalRules.Today;
            for (int i = 1; i <= 6; i++)
            {
                var v = cars[i % cars.Count];
                var start = today.AddMonths(-i).AddDays(-3);
                db.Bookings.Add(new Booking { Reference = $"ATL-DEMO-{i:0000}", Vehicle = v, User = customer, PickupLocation = loc, ReturnLocation = loc, StartDate = start, EndDate = start.AddDays(5), Days = 5, DailyRate = v.DailyRate, Total = v.DailyRate * 5, Deposit = v.Deposit, Status = "Completed", ReturnedAt = start.AddDays(5).ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromHours(10)), DateTimeKind.Utc), CreatedAt = start.AddDays(-7).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), CheckoutOdometer = 15000, ReturnOdometer = 15600, ReturnNotes = "Véhicule rendu en bon état — données de démonstration." });
            }
            await db.SaveChangesAsync();
        }
    }
}
