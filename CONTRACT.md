# Atlas Drive implementation contract

Local full-stack Moroccan car rental app, French UI, MAD currency, Casablanca/Rabat/Marrakech/Agadir. Brand Atlas Drive, premium warm off-white + deep forest green + lime accents. Runtime .NET 10 API :5180, Vite frontend :5273, FastAPI :8101, PostgreSQL :5433 dedicated cluster/database.

## API contract (JSON camelCase)
- GET /api/health
- POST /api/auth/register {fullName,email,password,phone} -> {token,user:{id,fullName,email,role}}
- POST /api/auth/login {email,password} -> same; GET /api/auth/me -> user
- GET /api/vehicles?search=&category=&transmission=&city=&minPrice=&maxPrice=&startDate=yyyy-MM-dd&endDate=yyyy-MM-dd -> Vehicle[]
- GET /api/vehicles/{id} -> Vehicle
- Vehicle: {id (int), brand,model,year,category,transmission,fuel,seats,dailyRate,deposit,imageUrl,city,description,features:string[],status:'Available'|'Maintenance',rating}
- GET /api/locations -> {id,name,address,city,latitude,longitude,phone}[]
- POST /api/quotes {vehicleId,startDate,endDate,insurance:'basic'|'premium',childSeat:boolean,additionalDriver:boolean} -> {days,dailyRate,rentalAmount,insuranceAmount,extrasAmount,total,deposit}
- POST /api/bookings (Bearer) {vehicleId,startDate,endDate,pickupLocationId,returnLocationId,insurance,childSeat,additionalDriver,notes} -> Booking
- GET /api/bookings (Bearer) -> own Booking[]; admin all
- GET /api/bookings/{id}/contract (Bearer, own/admin) -> text/html printable contract
- POST /api/bookings/{id}/cancel (Bearer, own/admin) -> Booking
- Booking: {id:int,reference,vehicleId,vehicleName,vehicleImageUrl,userName,userEmail,startDate,endDate,pickupLocationName,returnLocationName,days,dailyRate,total,deposit,status:'Confirmed'|'Active'|'Completed'|'Cancelled',createdAt,returnedAt?,returnNotes?}
- GET /api/admin/dashboard (Admin) -> {totalRevenue,totalBookings,activeRentals,availableVehicles,monthlyRevenue:[{month,revenue}],recentBookings:Booking[]}
- POST /api/admin/vehicles (Admin) Vehicle input (without id,rating) -> Vehicle; PUT /api/admin/vehicles/{id}; DELETE /api/admin/vehicles/{id} (archive/reject if booked)
- POST /api/admin/bookings/{id}/checkout (Admin) {odometer:int} -> Booking
- POST /api/admin/bookings/{id}/return (Admin) {odometer:int,notes:string,damageFee:decimal} -> Booking
- GET /api/admin/notifications (Admin) -> {id,title,message,createdAt,isRead}[]
- POST /api/admin/uploads (Admin multipart file) Cloudinary upload -> {url}; unconfigured returns explanatory 503
- POST /api/chat {message:string} -> {reply,source}; backend forwards AI service; OpenAI optional configured key.
- POST /api/recommendations {budget:number,passengers:int,category?:string} -> {vehicleIds:int[],explanation:string}; backend forwards AI service with actual available fleet, fallback deterministic if AI unavailable.
- SignalR /hubs/notifications authenticated Admin event 'BookingChanged'.

Errors: {message:string}. Dates ISO. Half-open rental interval [startDate,endDate); days=end-start minimum 1. Premium insurance 90 MAD/day; child seat 35/day; extra driver 50/day. No client-side total trusted. Availability excludes Confirmed/Active overlapping bookings. DB transaction protects concurrency. Auth roles Admin/Customer. No API credentials in frontend.

## Ownership
- backend agent: backend/ only (.NET EF Core Npgsql Identity JWT API integrations migrations)
- frontend agent: frontend/ only (React TS Tailwind shadcn components full UX)
- ai agent: ai/ only + AI Dockerfile (FastAPI sklearn recommendations + optional OpenAI Responses API)
- root: scripts/, root docs/config/compose, installation, database, integrated tests, VS Code setup.
