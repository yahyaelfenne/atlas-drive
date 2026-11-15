using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AtlasDrive.Api.Migrations
{
    /// <inheritdoc />
    public partial class ArchiveRentalAgencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Archived",
                table: "Locations",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Archived",
                table: "Locations");
        }
    }
}
