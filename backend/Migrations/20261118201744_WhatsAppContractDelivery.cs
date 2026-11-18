using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AtlasDrive.Api.Migrations
{
    /// <inheritdoc />
    public partial class WhatsAppContractDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContactWhatsApp",
                table: "Bookings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContractDeliveryChannel",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "email");

            migrationBuilder.AddColumn<bool>(
                name: "WhatsAppConsent",
                table: "Bookings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppMessageId",
                table: "Bookings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContactWhatsApp",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ContractDeliveryChannel",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "WhatsAppConsent",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "WhatsAppMessageId",
                table: "Bookings");
        }
    }
}
