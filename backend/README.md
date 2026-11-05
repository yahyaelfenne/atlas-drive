# Atlas Drive API

ASP.NET Core 10, Entity Framework Core, PostgreSQL, Identity, JWT, SignalR et Swagger.

Lancement recommandé : `./scripts/Start-Local.ps1` depuis la racine du projet. Les migrations EF sont appliquées au démarrage. `/api/health` indique la connexion PostgreSQL et la date de référence au Maroc ; `/swagger` est disponible en environnement Development. Les dates de location sont au format `yyyy-MM-dd`, les timestamps en UTC et la devise est MAD.

Configuration via variables d’environnement (ne jamais placer de secrets dans Git) :

| Variable | Usage |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | Connexion PostgreSQL |
| `Jwt__Key` | Clé aléatoire d’au moins 32 octets |
| `Jwt__Issuer`, `Jwt__Audience` | Valeur par défaut `AtlasDrive` |
| `Ai__BaseUrl` | Service FastAPI, défaut `http://127.0.0.1:8101` |
| `Cors__Origins` | Origines autorisées séparées par virgules |
| `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret` | Import signé de photos, administrateur uniquement |
| `Smtp__Host`, `Smtp__Port`, `Smtp__EnableSsl` | Notifications email ; port 587 et TLS activé par défaut |
| `Smtp__Username`, `Smtp__Password`, `Smtp__From` | Compte SMTP et expéditeur |
| `Seed__AdminEmail`, `Seed__AdminPassword` | Compte administrateur initial en Development uniquement |
| `Seed__CustomerEmail`, `Seed__CustomerPassword` | Compte client initial en Development uniquement |

Sans clés Cloudinary, l’import affiche une erreur explicite 503. Sans SMTP, les notifications sont conservées en base et diffusées via SignalR ; aucun email n’est envoyé. Sans service IA, l’API utilise une réponse locale et un classement déterministe. La clé OpenAI se configure uniquement dans le service Python.

Les comptes, véhicules, agences et contrats d’exemple ne sont créés qu’en Development. Le mode Production applique uniquement les migrations : prévoir une procédure privée de création du premier administrateur et un fournisseur SMTP réel avant mise en ligne. Les contrats générés sont des documents de démonstration à compléter et valider avant usage commercial.

La réservation, l’annulation, la modification de la flotte et les transitions de location utilisent un verrou transactionnel PostgreSQL par véhicule pour empêcher les écritures concurrentes incompatibles. L’historique conserve les véhicules archivés. Les montants sont calculés par l’API ; la caution reste séparée du prix. L’annulation concerne les réservations confirmées ; seuls les administrateurs enregistrent un départ et un retour.

Sources techniques consultées : [authentification JWT ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0), [transactions EF Core](https://learn.microsoft.com/ef/core/saving/transactions), [documentation Npgsql](https://www.npgsql.org/doc/basic-usage.html).
