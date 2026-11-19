using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

public class AppUser : IdentityUser { public string FullName { get; set; } = ""; }
public class Vehicle
{
    public int Id { get; set; }
    public string Brand { get; set; } = "";
    public string Model { get; set; } = "";
    public int Year { get; set; }
    public string Category { get; set; } = "Citadine";
    public string Transmission { get; set; } = "Automatique";
    public string Fuel { get; set; } = "Essence";
    public int Seats { get; set; } = 5;
    public decimal DailyRate { get; set; }
    public decimal Deposit { get; set; }
    public string ImageUrl { get; set; } = "";
    public string City { get; set; } = "Casablanca";
    public string Description { get; set; } = "";
    public string[] Features { get; set; } = [];
    public string Status { get; set; } = "Available";
    public decimal Rating { get; set; } = 4.8m;
    public bool Archived { get; set; }
}
public class Location
{
    public bool Archived { get; set; }
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Phone { get; set; } = "";
}
public class Booking
{
    public string ContractDeliveryChannel { get; set; } = "email";
    public string ContactWhatsApp { get; set; } = "";
    public bool WhatsAppConsent { get; set; }
    public string? WhatsAppMessageId { get; set; }
    public string ContactEmail { get; set; } = "";
    public string ContractEmailStatus { get; set; } = "NotQueued";
    public DateTime? ContractEmailSentAt { get; set; }
    public int ContractEmailAttempts { get; set; }
    public DateTime? ContractEmailNextAttemptAt { get; set; }
    public string? ContractEmailHtml { get; set; }
    public int Id { get; set; }
    public string Reference { get; set; } = "";
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int PickupLocationId { get; set; }
    public Location PickupLocation { get; set; } = null!;
    public int ReturnLocationId { get; set; }
    public Location ReturnLocation { get; set; } = null!;
    public int Days { get; set; }
    public decimal DailyRate { get; set; }
    public decimal Total { get; set; }
    public decimal Deposit { get; set; }
    public string Insurance { get; set; } = "basic";
    public bool ChildSeat { get; set; }
    public bool AdditionalDriver { get; set; }
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string PaymentStatus { get; set; } = "Unpaid";
    public string? PaymentReference { get; set; }
    public Guid? RequestKey { get; set; }
    public string ReviewNote { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnNotes { get; set; }
    public int? CheckoutOdometer { get; set; }
    public int? ReturnOdometer { get; set; }
    public decimal DamageFee { get; set; }
}
public class Notification
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
}
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<VehicleFinance> VehicleFinances => Set<VehicleFinance>();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<VehicleFinance>().HasKey(f => f.VehicleId);
        builder.Entity<VehicleFinance>().HasOne<Vehicle>().WithOne().HasForeignKey<VehicleFinance>(f => f.VehicleId).OnDelete(DeleteBehavior.Restrict);
        foreach (var field in new[] { "PurchasePrice", "DownPayment", "AnnualRate", "Insurance", "Maintenance", "OtherCosts", "MonthlyPaymentOverride" })
            builder.Entity<VehicleFinance>().Property(field).HasPrecision(12, 2);
        builder.Entity<Vehicle>().HasQueryFilter(v => !v.Archived);
        builder.Entity<Location>().HasQueryFilter(l => !l.Archived);
        builder.Entity<Vehicle>().Property(v => v.DailyRate).HasPrecision(12, 2);
        builder.Entity<Vehicle>().Property(v => v.Deposit).HasPrecision(12, 2);
        builder.Entity<Vehicle>().Property(v => v.Rating).HasPrecision(3, 2);
        builder.Entity<Booking>().Property(b => b.ContactWhatsApp).HasMaxLength(16);
        builder.Entity<Booking>().Property(b => b.ContactEmail).HasMaxLength(254);
        builder.Entity<Booking>().HasIndex(b => new { b.ContractEmailStatus, b.ContractEmailNextAttemptAt });
        builder.Entity<Booking>().HasIndex(b => b.Reference).IsUnique();
        builder.Entity<Booking>().HasIndex(b => new { b.UserId, b.RequestKey }).IsUnique();
        builder.Entity<Booking>().HasIndex(b => new { b.VehicleId, b.StartDate, b.EndDate });
        builder.Entity<Booking>().HasOne(b => b.Vehicle).WithMany().OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Booking>().HasOne(b => b.User).WithMany().OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Booking>().HasOne(b => b.PickupLocation).WithMany().OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Booking>().HasOne(b => b.ReturnLocation).WithMany().OnDelete(DeleteBehavior.Restrict);
        foreach (var field in new[] { "DailyRate", "Total", "Deposit", "DamageFee" }) builder.Entity<Booking>().Property<decimal>(field).HasPrecision(12, 2);
    }
}
public record RegisterInput(string FullName, string Email, string Password, string? Phone);
public record LoginInput(string Email, string Password);
public record QuoteInput(int VehicleId, DateOnly StartDate, DateOnly EndDate, string Insurance = "basic", bool ChildSeat = false, bool AdditionalDriver = false);
public record BookingInput(int VehicleId, DateOnly StartDate, DateOnly EndDate, int PickupLocationId, int ReturnLocationId, string Insurance = "basic", bool ChildSeat = false, bool AdditionalDriver = false, string? Notes = null, TestCardInput? Payment = null, Guid? RequestKey = null, string? ContactEmail = null, string ContractDeliveryChannel = "email", string? ContactWhatsApp = null, bool WhatsAppConsent = false);
public record TestCardInput(string Cardholder, string Number, string Expiry, string Cvc);
public record CheckoutInput(int Odometer);
public record ReturnInput(int Odometer, string? Notes, decimal DamageFee);
public record ChatTurn(string Role, string Content);
public record ChatInput(string Message, string Language = "auto", List<ChatTurn>? History = null);
public record RecommendInput(decimal Budget, int Passengers, string? Category);
public record PriceQuote(int Days, decimal DailyRate, decimal RentalAmount, decimal InsuranceAmount, decimal ExtrasAmount, decimal Total, decimal Deposit);
public record BookingDto(int Id, string Reference, int VehicleId, string VehicleName, string VehicleImageUrl, string UserName, string UserEmail, DateOnly StartDate, DateOnly EndDate, string PickupLocationName, string ReturnLocationName, int Days, decimal DailyRate, decimal Total, decimal Deposit, string Status, DateTime CreatedAt, DateTime? ReturnedAt, string? ReturnNotes, decimal DamageFee, string PaymentStatus, string ReviewNote, string ContactEmail, string ContractEmailStatus, DateTime? ContractEmailSentAt, string ContractDeliveryChannel, string ContactWhatsApp, string? WhatsAppMessageId);
public record ReviewInput(bool Approve, string? Note = null);
public class ApiException(int status, string message) : Exception(message) { public int Status { get; } = status; }
