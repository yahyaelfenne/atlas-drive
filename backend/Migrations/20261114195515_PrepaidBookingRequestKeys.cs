using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AtlasDrive.Api.Migrations
{
    /// <inheritdoc />
    public partial class PrepaidBookingRequestKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_UserId",
                table: "Bookings");

            migrationBuilder.AddColumn<Guid>(
                name: "RequestKey",
                table: "Bookings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_UserId_RequestKey",
                table: "Bookings",
                columns: new[] { "UserId", "RequestKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_UserId_RequestKey",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RequestKey",
                table: "Bookings");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_UserId",
                table: "Bookings",
                column: "UserId");
        }
    }
}
