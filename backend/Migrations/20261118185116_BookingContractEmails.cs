using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AtlasDrive.Api.Migrations
{
    /// <inheritdoc />
    public partial class BookingContractEmails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "Bookings",
                type: "character varying(254)",
                maxLength: 254,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ContractEmailAttempts",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ContractEmailHtml",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContractEmailNextAttemptAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContractEmailSentAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContractEmailStatus",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "NotQueued");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_ContractEmailStatus_ContractEmailNextAttemptAt",
                table: "Bookings",
                columns: new[] { "ContractEmailStatus", "ContractEmailNextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_ContractEmailStatus_ContractEmailNextAttemptAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractEmailAttempts",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractEmailHtml",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractEmailNextAttemptAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractEmailSentAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractEmailStatus",
                table: "Bookings");
        }
    }
}
