using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace AtlasDrive.Api;

// Private financial data deliberately lives outside the public Vehicle model.
public class VehicleFinance
{
    public int VehicleId { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal DownPayment { get; set; }
    public decimal AnnualRate { get; set; }
    public int Months { get; set; } = 60;
    public DateOnly StartMonth { get; set; }
    public decimal? MonthlyPaymentOverride { get; set; }
    public decimal Insurance { get; set; }
    public decimal Maintenance { get; set; }
    public decimal OtherCosts { get; set; }
    public bool IsEstimate { get; set; } = true;
}
public record MarketPrice(string Brand, string Model, decimal Price, string Source, string Label);

public static class Profitability
{
    public static decimal Instalment(VehicleFinance f, DateOnly month)
    {
        int elapsed = (month.Year - f.StartMonth.Year) * 12 + month.Month - f.StartMonth.Month;
        if (elapsed < 0 || elapsed >= f.Months) return 0;
        if (f.MonthlyPaymentOverride.HasValue) return f.MonthlyPaymentOverride.Value;
        decimal principal = f.PurchasePrice - f.DownPayment;
        if (f.AnnualRate == 0) return decimal.Round(principal / f.Months, 2);
        double rate = (double)f.AnnualRate / 1200;
        return decimal.Round(principal * (decimal)(rate / (1 - Math.Pow(1 + rate, -f.Months))), 2);
    }

    public static void MapProfitability(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin/profitability").RequireAuthorization(p => p.RequireRole("Admin"));
        admin.MapGet("", async (AppDbContext db, string? month, bool? includeTest) =>
        {
            month ??= DateTime.Today.ToString("yyyy-MM");
            if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) || start.Year < 2000 || start.Year > 2100)
                return Results.BadRequest(new { message = "Mois invalide (AAAA-MM)." });
            var end = start.AddMonths(1);
            var vehicles = await db.Vehicles.IgnoreQueryFilters().AsNoTracking().ToListAsync();
            var profiles = await db.VehicleFinances.AsNoTracking().ToDictionaryAsync(f => f.VehicleId);
            var bookings = await db.Bookings.IgnoreQueryFilters().AsNoTracking()
                .Where(b => (b.Status == "Confirmed" || b.Status == "Active" || b.Status == "Completed") && (b.PaymentStatus == "Paid" || b.PaymentStatus == "TestPaid"))
                .Select(b => new { b.VehicleId, b.Total, b.PaymentStatus, b.CreatedAt }).ToListAsync();
            var prices = JsonSerializer.Deserialize<MarketPrice[]>(File.ReadAllText(Path.Combine(app.Environment.ContentRootPath, "Data", "market-prices.json")), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            var rows = vehicles.Where(v => !v.Archived || profiles.ContainsKey(v.Id) || bookings.Any(b => b.VehicleId == v.Id)).Select(v =>
            {
                var price = prices.FirstOrDefault(p => p.Brand.Equals(v.Brand, StringComparison.OrdinalIgnoreCase) && p.Model.Equals(v.Model, StringComparison.OrdinalIgnoreCase));
                profiles.TryGetValue(v.Id, out var profile);
                bool saved = profile != null;
                bool premium = v.Brand is "BMW" or "Mercedes-Benz";
                bool suv = v.Category == "SUV";
                profile ??= price == null ? null : new VehicleFinance { VehicleId = v.Id, PurchasePrice = price.Price, DownPayment = price.Price * .2m, AnnualRate = 6.5m, Months = 60, StartMonth = new DateOnly(2026, 11, 1), Insurance = premium ? 1200 : suv ? 800 : 500, Maintenance = premium ? 650 : suv ? 450 : 250, OtherCosts = premium ? 300 : suv ? 250 : 150 };
                var receipts = bookings.Where(b => b.VehicleId == v.Id && DateOnly.FromDateTime(b.CreatedAt) >= start && DateOnly.FromDateTime(b.CreatedAt) < end).ToList();
                decimal realRevenue = receipts.Where(b => b.PaymentStatus == "Paid").Sum(b => b.Total);
                decimal testRevenue = receipts.Where(b => b.PaymentStatus == "TestPaid").Sum(b => b.Total);
                decimal revenue = realRevenue + (includeTest == true ? testRevenue : 0);
                decimal? credit = profile == null ? null : Instalment(profile, start);
                decimal? costs = profile == null ? null : profile.Insurance + profile.Maintenance + profile.OtherCosts;
                return new { VehicleId = v.Id, Name = v.Brand + " " + v.Model, v.ImageUrl, v.DailyRate, v.Archived, Profile = profile, Saved = saved, Market = price, RealRevenue = realRevenue, TestRevenue = testRevenue, Revenue = revenue, Credit = credit, Costs = costs, Balance = credit.HasValue ? revenue - credit - costs : null, BreakEvenDays = v.DailyRate > 0 && credit.HasValue ? (int?)Math.Ceiling((credit.Value + costs!.Value) / v.DailyRate) : null };
            }).OrderBy(r => r.Name).ToList();
            return Results.Ok(new { Month = month, IncludeTest = includeTest == true, CheckedAt = "2026-11-19", Rows = rows, Summary = new { Revenue = rows.Sum(r => r.Revenue), Credit = rows.Sum(r => r.Credit ?? 0), Costs = rows.Sum(r => r.Costs ?? 0), Balance = rows.Where(r => r.Profile != null).Sum(r => r.Balance ?? 0), Configured = rows.Count(r => r.Profile != null), Total = rows.Count } });
        });
        admin.MapPut("/{id:int}", async (int id, VehicleFinance input, AppDbContext db) =>
        {
            if (!await db.Vehicles.IgnoreQueryFilters().AnyAsync(v => v.Id == id)) return Results.NotFound();
            if (input.PurchasePrice <= 0 || input.PurchasePrice > 10000000 || input.DownPayment < 0 || input.DownPayment > input.PurchasePrice || input.AnnualRate < 0 || input.AnnualRate > 40 || input.Months < 1 || input.Months > 120 || input.StartMonth.Year < 2000 || input.StartMonth.Year > 2100 || input.Insurance < 0 || input.Maintenance < 0 || input.OtherCosts < 0 || input.MonthlyPaymentOverride < 0 || input.Insurance > 1000000 || input.Maintenance > 1000000 || input.OtherCosts > 1000000 || input.MonthlyPaymentOverride > 1000000)
                return Results.BadRequest(new { message = "Vérifiez les montants, l’apport, la durée (1–120 mois) et le taux (0–40 %)." });
            input.VehicleId = id;
            input.StartMonth = new DateOnly(input.StartMonth.Year, input.StartMonth.Month, 1);
            var existing = await db.VehicleFinances.FindAsync(id);
            if (existing == null) db.VehicleFinances.Add(input);
            else db.Entry(existing).CurrentValues.SetValues(input);
            await db.SaveChangesAsync();
            return Results.Ok(input);
        });
        admin.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var profile = await db.VehicleFinances.FindAsync(id);
            if (profile != null) { db.VehicleFinances.Remove(profile); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });
    }
}
