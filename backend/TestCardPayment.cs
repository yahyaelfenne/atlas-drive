using System.Text.RegularExpressions;

namespace AtlasDrive.Api;

// Development-only simulator. Card input is validated in memory, never persisted or logged.
public static class TestCardPayment
{
    public static void Validate(TestCardInput? card, IConfiguration config, bool development)
    {
        if (!development || !config.GetValue("Payments:TestEnabled", true)) throw new ApiException(503, "Le paiement test est désactivé. Aucun prestataire de paiement réel n’est configuré.");
        if (card is null) throw new ApiException(400, "Le paiement par carte test est obligatoire avant l’envoi de la demande.");
        if (string.IsNullOrWhiteSpace(card.Cardholder) || card.Cardholder.Trim().Length < 2 || card.Cardholder.Length > 100 || !card.Cardholder.Any(char.IsLetter)) throw new ApiException(400, "Indiquez le nom du titulaire de la carte de test.");
        if (card.Number is null || card.Number.Length > 25) throw new ApiException(400, "Utilisez uniquement les numéros de carte de test indiqués.");
        var number = Regex.Replace(card.Number, @"[\s-]", "");
        if (number is not ("4242424242424242" or "4000000000000002")) throw new ApiException(400, "Carte de test uniquement : 4242 4242 4242 4242 (acceptée) ou 4000 0000 0000 0002 (refusée). N’utilisez aucune carte réelle.");
        if (card.Cvc is null || !Regex.IsMatch(card.Cvc, @"^[0-9]{3}$")) throw new ApiException(400, "Saisissez un CVC de test à 3 chiffres.");
        var expiry = Regex.Match(card.Expiry ?? "", @"^(0[1-9]|1[0-2])/([0-9]{2}|[0-9]{4})$");
        if (!expiry.Success) throw new ApiException(400, "Date d’expiration de test invalide : utilisez MM/AA.");
        var month = int.Parse(expiry.Groups[1].Value);
        var year = int.Parse(expiry.Groups[2].Value);
        if (year < 100) year += 2000;
        if (year < 2000 || new DateOnly(year, month, DateTime.DaysInMonth(year, month)) < RentalRules.Today) throw new ApiException(400, "Cette carte de test est expirée.");
        if (number == "4000000000000002") throw new ApiException(402, "Paiement de test refusé. Aucun débit ni demande créée. Réessayez avec 4242 4242 4242 4242.");
    }
}
