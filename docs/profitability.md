# Rentabilité de la flotte

Disponible dans Administration → Rentabilité sur le site et l’application Expo.
Les profils de financement sont privés, liés au véhicule dans `VehicleFinances`,
et accessibles exclusivement aux administrateurs. L’API publique des voitures
ne contient aucun montant d’achat ou de financement.

## Références et hypothèses

Les 14 prix de référence et leurs sources sont conservés dans
`backend/Data/market-prices.json`, consultation du 19 novembre 2026.
Ce sont des prix d’appel neufs (ou une offre commerciale BMW), pas des factures,
des évaluations d’occasion, ni nécessairement la finition ou l’année de la flotte.
Les sources constructeur sont privilégiées ; Hyundai, Fiat et Sandero utilisent
des guides automobiles marocains lorsque le tarif constructeur n’est pas accessible.
Les montants n’incluent pas nécessairement immatriculation, options et taxes annexes.

Le scénario initial utilise 20 % d’apport, 60 mensualités, un taux nominal annuel
**hypothétique de 6,5 %**, et un début simulé au 1er novembre 2026.
Ce taux n’est pas une offre bancaire et n’est pas un TAEG.
Les budgets assurance / entretien / autres frais, en MAD par mois, sont également
des hypothèses modifiables, sans devis d’assurance pour l’activité de location :

| Catégorie           | Assurance | Entretien | Autres |
| ------------------- | --------: | --------: | -----: |
| Citadine / berline  |       500 |       250 |    150 |
| SUV                 |       800 |       450 |    250 |
| BMW / Mercedes-Benz |     1 200 |       650 |    300 |

Une voiture inconnue du catalogue reste « À renseigner » : aucun coût nul n’est
inventé. L’enregistrement admin persiste le profil en base. Le drapeau
« Montants estimés » reste actif tant que l’admin ne le change pas explicitement.
Une mensualité contractuelle saisie remplace le calcul automatique.

## Calculs et limites

Capital financé = prix d’achat − apport. Mensualité calculée par annuité constante,
avec taux mensuel = taux annuel / 12. À taux nul : capital / nombre de mois.
La mensualité est nulle avant le début et après la dernière échéance prévue.
Les charges mensuelles continuent après le crédit et pour les voitures archivées.
Aucun historique de paiement effectif des mensualités n’est supposé.

Les revenus sont les totaux des réservations **Paid** et, si activé, **TestPaid**,
aux statuts **Confirmed, Active, Completed**. Les demandes en attente, refusées,
annulées et remboursées ne comptent pas. Le mois retenu est `CreatedAt` du paiement
créé avec la réservation, comme dans le tableau de bord existant. Ce n’est pas
une ventilation du chiffre d’affaires par jour de location. Les cautions et frais
de retour non encaissés sont exclus. Le mode test est identifié dans l’interface.

Solde = revenus − mensualité − charges budgétées. Ce **solde de trésorerie** n’est
pas un résultat net comptable : il exclut l’apport initial, les impôts,
l’amortissement, les frais exceptionnels et les dépenses non renseignées.
Le total du solde porte uniquement sur les voitures dont les coûts sont renseignés,
avec leur nombre affiché. Le seuil indicatif = plafond((crédit + charges) / tarif
journalier), sans remise ni frais variables ; il peut dépasser les jours du mois.

## Vérification

`scripts/test-profitability.py` vérifie les revenus contre les réservations,
les rôles, la confidentialité, l’annuité, le taux zéro, les limites de période,
les mensualités forcées, la persistance, les validations et l’archivage.
Il crée sa propre voiture QA puis retire son profil et archive cette voiture.
Le script est aussi intégré à `Verify.ps1` pour une base isolée.
