using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using AtlasDrive.Api;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
var jwtKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32) throw new InvalidOperationException("Configure Jwt:Key with at least 32 bytes (use scripts/Start-Local.ps1).");
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(config.GetConnectionString("DefaultConnection") ?? "Host=127.0.0.1;Port=5433;Database=atlas_drive;Username=atlas"));
builder.Services.AddIdentityCore<AppUser>(o => { o.User.RequireUniqueEmail = true; o.Password.RequiredLength = 10; o.Password.RequireDigit = true; o.Password.RequireNonAlphanumeric = true; o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10); }).AddRoles<IdentityRole>().AddEntityFrameworkStores<AppDbContext>().AddSignInManager();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new() { ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true, ValidIssuer = config["Jwt:Issuer"] ?? "AtlasDrive", ValidAudience = config["Jwt:Audience"] ?? "AtlasDrive", IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), ClockSkew = TimeSpan.FromSeconds(30) };
    o.Events = new() { OnMessageReceived = context => { var token = context.Request.Query["access_token"]; if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs/notifications")) context.Token = token; return Task.CompletedTask; } };
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins((config["Cors:Origins"] ?? "http://localhost:5273,http://127.0.0.1:5273").Split(',', StringSplitOptions.RemoveEmptyEntries)).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddSignalR();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<BookingEvents>();
builder.Services.AddHttpClient("ai", c => { c.BaseAddress = new Uri((config["Ai:BaseUrl"] ?? "http://127.0.0.1:8101").TrimEnd('/') + "/"); c.Timeout = TimeSpan.FromSeconds(20); });
builder.Services.AddHttpClient("cloudinary", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new() { Title = "Atlas Drive API", Version = "v1", Description = "Location de véhicules — authentification JWT, flotte, réservations, contrats et retours." });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", Description = "Connectez-vous via /api/auth/login puis collez la valeur token." });
    o.AddSecurityRequirement(document => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] });
});
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new() { PermitLimit = 12, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("ai", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new() { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.OnRejected = async (context, ct) => await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Trop de tentatives. Réessayez dans une minute." }, ct);
});
var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    try { await next(); }
    catch (ApiException ex) { context.Response.StatusCode = ex.Status; await context.Response.WriteAsJsonAsync(new { message = ex.Message }); }
    catch (BadHttpRequestException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { message = "Requête invalide. Vérifiez les champs et les dates." }); }
    catch (DbUpdateException ex) { app.Logger.LogError(ex, "Database write failed"); context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { message = "Cette opération entre en conflit avec une donnée existante. Actualisez puis réessayez." }); }
    catch (Exception ex) { app.Logger.LogError(ex, "Request failed"); context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { message = "Le service est momentanément indisponible." }); }
});
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
await SeedData.Run(app.Services, app.Environment.IsDevelopment());
app.MapGet("/api/health", async (AppDbContext db) => Results.Ok(new { status = "ok", database = await db.Database.CanConnectAsync() ? "connected" : "unavailable", service = "Atlas Drive API", today = RentalRules.Today.ToString("yyyy-MM-dd") }));

app.MapPost("/api/auth/register", async (RegisterInput input, UserManager<AppUser> users, TokenService tokens, RoleManager<IdentityRole> roles) =>
{
    if (string.IsNullOrWhiteSpace(input.FullName) || input.FullName.Length > 100 || string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 254 || !System.Net.Mail.MailAddress.TryCreate(input.Email, out _) || string.IsNullOrEmpty(input.Password) || input.Password.Length > 128 || input.Phone?.Length > 30) throw new ApiException(400, "Nom, email, mot de passe ou téléphone invalide.");
    var user = new AppUser { UserName = input.Email.Trim(), Email = input.Email.Trim(), FullName = input.FullName.Trim(), PhoneNumber = input.Phone?.Trim() };
    var result = await users.CreateAsync(user, input.Password);
    if (!result.Succeeded) throw new ApiException(400, "Création impossible. Utilisez un email unique et un mot de passe d’au moins 10 caractères avec majuscule, minuscule, chiffre et symbole.");
    if (!await roles.RoleExistsAsync("Customer")) await roles.CreateAsync(new("Customer"));
    await users.AddToRoleAsync(user, "Customer");
    return Results.Ok(await tokens.Issue(user));
}).RequireRateLimiting("auth");
app.MapPost("/api/auth/login", async (LoginInput input, UserManager<AppUser> users, SignInManager<AppUser> signIn, TokenService tokens) =>
{
    if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrEmpty(input.Password) || input.Email.Length > 254 || input.Password.Length > 128) throw new ApiException(400, "Email et mot de passe requis.");
    var user = await users.FindByEmailAsync(input.Email.Trim());
    if (user is null || !(await signIn.CheckPasswordSignInAsync(user, input.Password, true)).Succeeded) throw new ApiException(401, "Email ou mot de passe incorrect, ou compte temporairement verrouillé.");
    return Results.Ok(await tokens.Issue(user));
}).RequireRateLimiting("auth");
app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
{
    var user = await users.FindByIdAsync(RentalRules.UserId(principal)) ?? throw new ApiException(401, "Compte introuvable.");
    return Results.Ok(new { user.Id, user.FullName, user.Email, role = principal.IsInRole("Admin") ? "Admin" : "Customer" });
}).RequireAuthorization();

app.MapGet("/api/locations", async (AppDbContext db) => await db.Locations.OrderBy(l => l.Id).ToListAsync());
app.MapGet("/api/vehicles", async (AppDbContext db, string? search, string? category, string? transmission, string? city, decimal? minPrice, decimal? maxPrice, DateOnly? startDate, DateOnly? endDate) =>
{
    var query = db.Vehicles.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(search))
    {
        if (search.Length > 200) throw new ApiException(400, "Recherche trop longue.");
        query = query.Where(v => EF.Functions.ToTsVector("simple", v.Brand + " " + v.Model + " " + v.Category + " " + v.Description + " " + string.Join(" ", v.Features)).Matches(EF.Functions.PlainToTsQuery("simple", search)));
    }
    if (!string.IsNullOrWhiteSpace(category)) query = query.Where(v => v.Category == category);
    if (!string.IsNullOrWhiteSpace(transmission)) query = query.Where(v => v.Transmission == transmission);
    if (!string.IsNullOrWhiteSpace(city)) query = query.Where(v => v.City == city);
    if (minPrice.HasValue) query = query.Where(v => v.DailyRate >= minPrice);
    if (maxPrice.HasValue) query = query.Where(v => v.DailyRate <= maxPrice);
    if (startDate.HasValue != endDate.HasValue) throw new ApiException(400, "Indiquez les deux dates.");
    if (startDate.HasValue && endDate.HasValue)
    {
        RentalRules.Dates(startDate.Value, endDate.Value);
        query = query.Where(v => v.Status == "Available" && !db.Bookings.Any(b => b.VehicleId == v.Id && (b.Status == "Confirmed" || b.Status == "Active") && b.StartDate < endDate.Value && b.EndDate > startDate.Value));
    }
    return await query.OrderBy(v => v.DailyRate).ToListAsync();
});
app.MapGet("/api/vehicles/{id:int}", async (int id, AppDbContext db) => await db.Vehicles.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "Véhicule introuvable."));
app.MapPost("/api/quotes", async (QuoteInput input, AppDbContext db) =>
{
    var vehicle = await db.Vehicles.FindAsync(input.VehicleId) ?? throw new ApiException(404, "Véhicule introuvable.");
    if (vehicle.Status != "Available") throw new ApiException(409, "Véhicule en maintenance.");
    var quote = RentalRules.Quote(vehicle, input);
    if (await db.Bookings.AnyAsync(b => b.VehicleId == input.VehicleId && (b.Status == "Confirmed" || b.Status == "Active") && b.StartDate < input.EndDate && b.EndDate > input.StartDate)) throw new ApiException(409, "Véhicule déjà réservé pour ces dates.");
    return quote;
});

var bookings = app.MapGroup("/api/bookings").RequireAuthorization();
bookings.MapGet("", async (AppDbContext db, ClaimsPrincipal user) =>
{
    var query = RentalRules.Full(db).AsNoTracking();
    if (!user.IsInRole("Admin")) { var userId = RentalRules.UserId(user); query = query.Where(b => b.UserId == userId); }
    return (await query.OrderByDescending(b => b.CreatedAt).Take(1000).ToListAsync()).Select(RentalRules.Dto);
});
bookings.MapGet("/{id:int}", async (int id, AppDbContext db, ClaimsPrincipal user) =>
{
    var booking = await RentalRules.Full(db).AsNoTracking().FirstOrDefaultAsync(b => b.Id == id) ?? throw new ApiException(404, "Réservation introuvable.");
    RentalRules.Own(booking, user);
    return RentalRules.Dto(booking);
});
bookings.MapPost("", async (BookingInput input, AppDbContext db, ClaimsPrincipal principal, BookingEvents events) =>
{
    if (input.Notes?.Length > 2000) throw new ApiException(400, "Les notes sont limitées à 2000 caractères.");
    RentalRules.Dates(input.StartDate, input.EndDate);
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({input.VehicleId})");
    var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.Id == input.VehicleId) ?? throw new ApiException(404, "Véhicule introuvable.");
    if (vehicle.Status != "Available") throw new ApiException(409, "Véhicule en maintenance.");
    if (await db.Bookings.AnyAsync(b => b.VehicleId == input.VehicleId && (b.Status == "Confirmed" || b.Status == "Active") && b.StartDate < input.EndDate && b.EndDate > input.StartDate)) throw new ApiException(409, "Ce véhicule vient d’être réservé pour ces dates. Choisissez un autre créneau.");
    var pickup = await db.Locations.FindAsync(input.PickupLocationId) ?? throw new ApiException(400, "Agence de départ invalide.");
    var destination = await db.Locations.FindAsync(input.ReturnLocationId) ?? throw new ApiException(400, "Agence de retour invalide.");
    if (pickup.City != vehicle.City) throw new ApiException(400, "Choisissez une agence de départ dans la ville du véhicule.");
    var quote = RentalRules.Quote(vehicle, new(input.VehicleId, input.StartDate, input.EndDate, input.Insurance, input.ChildSeat, input.AdditionalDriver));
    var user = await db.Users.FindAsync(RentalRules.UserId(principal)) ?? throw new ApiException(401, "Compte introuvable.");
    var booking = new Booking { Reference = "ATL-" + DateTime.UtcNow.ToString("yyMMdd") + "-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(4)), Vehicle = vehicle, User = user, StartDate = input.StartDate, EndDate = input.EndDate, PickupLocation = pickup, ReturnLocation = destination, Days = quote.Days, DailyRate = quote.DailyRate, Total = quote.Total, Deposit = quote.Deposit, Insurance = input.Insurance, ChildSeat = input.ChildSeat, AdditionalDriver = input.AdditionalDriver, Notes = input.Notes?.Trim() ?? "" };
    db.Bookings.Add(booking);
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    await events.Notify(booking, "Réservation confirmée");
    return Results.Created($"/api/bookings/{booking.Id}", RentalRules.Dto(booking));
});
bookings.MapGet("/{id:int}/contract", async (int id, AppDbContext db, ClaimsPrincipal user) =>
{
    var booking = await RentalRules.Full(db).FirstOrDefaultAsync(b => b.Id == id) ?? throw new ApiException(404, "Réservation introuvable.");
    RentalRules.Own(booking, user);
    return Results.Content(RentalContract.Html(booking), "text/html; charset=utf-8");
});
bookings.MapPost("/{id:int}/cancel", async (int id, AppDbContext db, ClaimsPrincipal user, BookingEvents events) =>
{
    var vehicleId = await db.Bookings.Where(b => b.Id == id).Select(b => (int?)b.VehicleId).FirstOrDefaultAsync() ?? throw new ApiException(404, "Réservation introuvable.");
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({vehicleId})");
    var booking = await RentalRules.Full(db).FirstAsync(b => b.Id == id);
    RentalRules.Own(booking, user);
    if (booking.Status != "Confirmed") throw new ApiException(409, "Seule une réservation confirmée peut être annulée.");
    booking.Status = "Cancelled";
    await db.SaveChangesAsync(); await transaction.CommitAsync();
    await events.Notify(booking, "Réservation annulée");
    return RentalRules.Dto(booking);
});

var admin = app.MapGroup("/api/admin").RequireAuthorization(p => p.RequireRole("Admin"));
admin.MapGet("/dashboard", async (AppDbContext db) =>
{
    var all = await RentalRules.Full(db).AsNoTracking().ToListAsync();
    var today = RentalRules.Today;
    var months = Enumerable.Range(0, 6).Select(i => DateTime.UtcNow.AddMonths(i - 5)).Select(m => new { month = m.ToString("yyyy-MM"), revenue = all.Where(b => b.Status == "Completed" && b.EndDate.Year == m.Year && b.EndDate.Month == m.Month).Sum(b => b.Total + b.DamageFee) }).ToArray();
    return new { totalRevenue = all.Where(b => b.Status == "Completed").Sum(b => b.Total + b.DamageFee), totalBookings = all.Count, activeRentals = all.Count(b => b.Status == "Active"), availableVehicles = await db.Vehicles.CountAsync(v => v.Status == "Available" && !db.Bookings.Any(b => b.VehicleId == v.Id && (b.Status == "Active" || b.Status == "Confirmed") && b.StartDate <= today && b.EndDate > today)), monthlyRevenue = months, recentBookings = all.OrderByDescending(b => b.CreatedAt).Take(8).Select(RentalRules.Dto) };
});
admin.MapGet("/notifications", async (AppDbContext db) => await db.Notifications.AsNoTracking().OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync());
admin.MapPost("/vehicles", async (Vehicle input, AppDbContext db) =>
{
    RentalRules.Vehicle(input); input.Id = 0; input.Archived = false; input.Rating = 4.8m;
    db.Vehicles.Add(input); await db.SaveChangesAsync(); return Results.Created($"/api/vehicles/{input.Id}", input);
});
admin.MapPut("/vehicles/{id:int}", async (int id, Vehicle input, AppDbContext db) =>
{
    RentalRules.Vehicle(input);
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({id})");
    var v = await db.Vehicles.FirstOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "Véhicule introuvable.");
    if (input.City != v.City && await db.Bookings.AnyAsync(b => b.VehicleId == id && (b.Status == "Confirmed" || b.Status == "Active"))) throw new ApiException(409, "Impossible de déplacer un véhicule avec des locations en cours ou confirmées.");
    v.Brand = input.Brand.Trim(); v.Model = input.Model.Trim(); v.Year = input.Year; v.Category = input.Category; v.Transmission = input.Transmission; v.Fuel = input.Fuel; v.Seats = input.Seats; v.DailyRate = input.DailyRate; v.Deposit = input.Deposit; v.ImageUrl = input.ImageUrl; v.City = input.City; v.Description = input.Description; v.Features = input.Features; v.Status = input.Status;
    await db.SaveChangesAsync(); await transaction.CommitAsync(); return v;
});
admin.MapDelete("/vehicles/{id:int}", async (int id, AppDbContext db) =>
{
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({id})");
    var v = await db.Vehicles.FirstOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "Véhicule introuvable.");
    if (await db.Bookings.AnyAsync(b => b.VehicleId == id && (b.Status == "Confirmed" || b.Status == "Active"))) throw new ApiException(409, "Ce véhicule possède des réservations actives ou confirmées.");
    v.Archived = true; await db.SaveChangesAsync(); await transaction.CommitAsync(); return Results.NoContent();
});
admin.MapPost("/bookings/{id:int}/checkout", async (int id, CheckoutInput input, AppDbContext db, BookingEvents events) =>
{
    if (input.Odometer < 0 || input.Odometer > 3000000) throw new ApiException(400, "Kilométrage invalide.");
    var vehicleId = await db.Bookings.Where(b => b.Id == id).Select(b => (int?)b.VehicleId).FirstOrDefaultAsync() ?? throw new ApiException(404, "Réservation introuvable.");
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({vehicleId})");
    var b = await RentalRules.Full(db).FirstAsync(b => b.Id == id);
    if (b.Status != "Confirmed") throw new ApiException(409, "La réservation doit être confirmée.");
    if (b.Vehicle.Status != "Available") throw new ApiException(409, "Le véhicule est en maintenance.");
    if (b.StartDate > RentalRules.Today) throw new ApiException(409, "La prise en charge n’est possible qu’à partir de la date de départ.");
    if (b.EndDate <= RentalRules.Today) throw new ApiException(409, "La période de cette réservation est terminée.");
    if (await db.Bookings.AnyAsync(other => other.VehicleId == vehicleId && other.Id != id && other.Status == "Active")) throw new ApiException(409, "Ce véhicule est déjà en location.");
    b.Status = "Active"; b.CheckoutOdometer = input.Odometer;
    await db.SaveChangesAsync(); await transaction.CommitAsync(); await events.Notify(b, "Départ du véhicule enregistré"); return RentalRules.Dto(b);
});
admin.MapPost("/bookings/{id:int}/return", async (int id, ReturnInput input, AppDbContext db, BookingEvents events) =>
{
    if (input.Odometer < 0 || input.Odometer > 3000000 || input.DamageFee < 0 || input.DamageFee > 1000000 || input.Notes?.Length > 2000) throw new ApiException(400, "Kilométrage, frais ou notes invalides.");
    var vehicleId = await db.Bookings.Where(b => b.Id == id).Select(b => (int?)b.VehicleId).FirstOrDefaultAsync() ?? throw new ApiException(404, "Réservation introuvable.");
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({vehicleId})");
    var b = await RentalRules.Full(db).FirstAsync(b => b.Id == id);
    if (b.Status != "Active") throw new ApiException(409, "Seule une location en cours peut être retournée.");
    if (input.Odometer < b.CheckoutOdometer) throw new ApiException(400, "Le kilométrage de retour doit être supérieur au départ.");
    b.Status = "Completed"; b.ReturnOdometer = input.Odometer; b.ReturnedAt = DateTime.UtcNow; b.ReturnNotes = input.Notes?.Trim(); b.DamageFee = input.DamageFee; b.Vehicle.City = b.ReturnLocation.City;
    await db.SaveChangesAsync(); await transaction.CommitAsync(); await events.Notify(b, "Retour du véhicule enregistré"); return RentalRules.Dto(b);
});
admin.MapPost("/uploads", async (HttpRequest request, IConfiguration cfg, IHttpClientFactory clients) =>
{
    var cloud = cfg["Cloudinary:CloudName"]; var apiKey = cfg["Cloudinary:ApiKey"]; var secret = cfg["Cloudinary:ApiSecret"];
    if (string.IsNullOrWhiteSpace(cloud) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(secret)) throw new ApiException(503, "Configurez Cloudinary:CloudName, ApiKey et ApiSecret pour importer des photos.");
    if (request.ContentLength > 9 * 1024 * 1024) throw new ApiException(400, "Image limitée à 8 Mo.");
    if (!request.HasFormContentType) throw new ApiException(400, "Envoyez une image dans le champ file.");
    var form = await request.ReadFormAsync(); var file = form.Files.GetFile("file");
    if (file is null || file.Length < 12 || file.Length > 8 * 1024 * 1024 || file.ContentType is not ("image/jpeg" or "image/png" or "image/webp")) throw new ApiException(400, "Utilisez une image JPEG, PNG ou WebP de moins de 8 Mo.");
    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(); const string folder = "atlas-drive";
    var signature = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes($"folder={folder}&timestamp={timestamp}{secret}"))).ToLowerInvariant();
    using var content = new MultipartFormDataContent();
    content.Add(new StringContent(apiKey), "api_key"); content.Add(new StringContent(timestamp), "timestamp"); content.Add(new StringContent(folder), "folder"); content.Add(new StringContent(signature), "signature");
    using var stream = file.OpenReadStream(); var fileContent = new StreamContent(stream); fileContent.Headers.ContentType = new(file.ContentType); content.Add(fileContent, "file", "vehicle-image");
    using var response = await clients.CreateClient("cloudinary").PostAsync($"https://api.cloudinary.com/v1_1/{Uri.EscapeDataString(cloud)}/image/upload", content);
    if (!response.IsSuccessStatusCode) throw new ApiException(502, "Cloudinary n’a pas pu importer cette image.");
    var result = await response.Content.ReadFromJsonAsync<JsonElement>(); return Results.Ok(new { url = result.GetProperty("secure_url").GetString() });
}).DisableAntiforgery();

app.MapPost("/api/chat", async (ChatInput input, AppDbContext db, IHttpClientFactory clients) =>
{
    if (string.IsNullOrWhiteSpace(input.Message) || input.Message.Length > 2000) throw new ApiException(400, "Le message doit contenir entre 1 et 2000 caractères.");
    try
    {
        var fleet = await db.Vehicles.AsNoTracking().Where(v => v.Status == "Available").Select(v => new { v.Brand, v.Model, v.DailyRate, v.City }).ToListAsync();
        var locations = await db.Locations.AsNoTracking().ToListAsync();
        using var response = await clients.CreateClient("ai").PostAsJsonAsync("chat", new { message = input.Message, context = new { vehicles = fleet, locations, currency = "MAD", premiumInsurancePerDay = 90, childSeatPerDay = 35, additionalDriverPerDay = 50 } });
        if (response.IsSuccessStatusCode) return Results.Json(await response.Content.ReadFromJsonAsync<JsonElement>());
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { app.Logger.LogWarning("AI chat service unavailable"); }
    return Results.Ok(new { reply = "Bienvenue chez Atlas Drive ! Choisissez vos dates et votre ville dans Notre flotte. Le prix est calculé par jour, assurance basic incluse. L’assurance premium coûte 90 MAD/jour. Présentez un permis valide et une pièce d’identité à l’agence. Pour votre réservation, connectez-vous puis sélectionnez votre véhicule.", source = "local-fallback" });
}).RequireRateLimiting("ai");
app.MapPost("/api/recommendations", async (RecommendInput input, AppDbContext db, IHttpClientFactory clients) =>
{
    if (input.Budget < 50 || input.Budget > 100000 || input.Passengers < 1 || input.Passengers > 9 || input.Category?.Length > 100) throw new ApiException(400, "Budget, catégorie ou nombre de passagers invalide.");
    var vehicles = await db.Vehicles.AsNoTracking().Where(v => v.Status == "Available").ToListAsync();
    try
    {
        using var response = await clients.CreateClient("ai").PostAsJsonAsync("recommendations", new { input.Budget, input.Passengers, input.Category, vehicles });
        if (response.IsSuccessStatusCode) return Results.Json(await response.Content.ReadFromJsonAsync<JsonElement>());
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { app.Logger.LogWarning("AI recommendation service unavailable"); }
    var selected = vehicles.Where(v => v.Seats >= input.Passengers && v.DailyRate <= input.Budget && (string.IsNullOrWhiteSpace(input.Category) || v.Category == input.Category)).OrderByDescending(v => v.Rating).ThenBy(v => v.DailyRate).Take(3).Select(v => v.Id);
    return Results.Ok(new { vehicleIds = selected, explanation = "Sélection selon votre budget journalier, le nombre de places et la catégorie demandée." });
}).RequireRateLimiting("ai");
app.MapHub<NotificationsHub>("/hubs/notifications");
app.Run();
