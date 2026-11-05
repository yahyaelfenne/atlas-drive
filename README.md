# Atlas Drive

Application locale de location de voitures au Maroc, avec interface française et prix en MAD. Le projet est ouvert dans VS Code via `atlas-drive.code-workspace`.

## Demarrer sur ce PC

Depuis le dossier du projet dans un terminal PowerShell :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Local.ps1
```

Pour une nouvelle installation ou apres modification des dependances :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Local.ps1 -Install
```

Le premier lancement necessite .NET SDK 10, Node.js 24, Python 3.13 et PostgreSQL 18. Ces outils sont deja presents sur ce PC. Docker reste facultatif. Le script cree un cluster PostgreSQL dedie au projet sur le port **5433**, avec authentification SCRAM et secrets aleatoires conserves dans `.local/settings.json`. Il ne modifie aucun service PostgreSQL existant. Les processus tournent en arriere-plan ; les journaux sont dans `.local/`.

Dans VS Code : **Terminal > Run Task > Atlas Drive: demarrer**. Les taches d'installation, de verification et d'arret sont aussi fournies.

| Service | Adresse |
| --- | --- |
| Site React | http://127.0.0.1:5273 |
| API / Swagger | http://127.0.0.1:5180/swagger |
| FastAPI / documentation | http://127.0.0.1:8101/docs |
| PostgreSQL | 127.0.0.1:5433, base `atlas_drive`, utilisateur `atlas` |

Comptes de demonstration, crees uniquement en environnement `Development` :

| Role | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | admin@atlasdrive.ma | AtlasAdmin2026! |
| Client | client@atlasdrive.ma | AtlasClient2026! |

Les vehicules, agences et reservations initiales sont des donnees de demonstration. Les photos sont illustratives. Aucun paiement en ligne n'est effectue. La caution est affichee separement du montant de location.

## Fonctionnalites

- Catalogue avec recherche PostgreSQL, filtres, dates et disponibilite reelle.
- Inscription, connexion Identity + JWT, roles et controle de propriete des reservations.
- Devis serveur selon le nombre de jours, assurance et options ; reservation protegee contre les chevauchements concurrents.
- Espace client : historique, annulation et contrat HTML imprimable (impression PDF depuis le navigateur).
- Administration : indicateurs, revenus mensuels, gestion de flotte, depart avec kilometrage, retour avec inspection et frais de dommages.
- Notifications persistantes et temps reel SignalR.
- Carte des agences Leaflet + OpenStreetMap.
- Recommandations scikit-learn a partir de la flotte courante, avec contraintes de budget et de places.
- Assistant FAQ local ; appels OpenAI facultatifs si une cle est configuree.
- Upload photo Cloudinary et email SMTP configures cote serveur.

## Stack et structure

```text
frontend/   React + TypeScript + Vite + Tailwind CSS + composants shadcn/ui/Radix
backend/    ASP.NET Core Web API C# + EF Core + Npgsql + Identity/JWT + SignalR
ai/         Python + FastAPI + scikit-learn + SDK OpenAI
scripts/    Installation, demarrage, arret et verification Windows
.vscode/    Taches VS Code
compose.yaml Docker Compose : PostgreSQL, API, IA, frontend Nginx
```

Le frontend utilise le proxy Vite `/api` et `/hubs`. Les montants et les droits d'acces sont valides par l'API. La periode de location est `[depart, retour)` : du 10 au 13 correspond a 3 jours. Le tarif journalier est fige au moment de la reservation.

`CONTRACT.md` decrit les schemas et routes. Les migrations EF Core sont appliquees au lancement de l'API. La documentation Swagger expose les routes et permet d'envoyer le JWT via **Authorize**.

## Services externes facultatifs

Les identifiants externes ne sont pas fournis. Sans configuration, le chatbot indique sa source locale, les recommandations restent operationnelles, l'upload Cloudinary renvoie une erreur explicite et aucun email n'est envoye.

Copier le bloc suivant dans le fichier **ignore par Git** `.local/integrations.ps1`, puis arreter et redemarrer les services :

```powershell
# Python uniquement
$env:OPENAI_API_KEY = 'votre-cle'
# Facultatif : modele disponible pour votre compte
$env:OPENAI_MODEL = 'gpt-5.4-mini'
# API .NET uniquement
$env:Cloudinary__CloudName = 'votre-cloud'
$env:Cloudinary__ApiKey = 'votre-cle'
$env:Cloudinary__ApiSecret = 'votre-secret'
$env:Smtp__Host = 'smtp.votre-domaine.com'
$env:Smtp__Port = '587'
$env:Smtp__EnableSsl = 'true'
$env:Smtp__Username = 'votre-utilisateur'
$env:Smtp__Password = 'votre-secret'
$env:Smtp__From = 'reservations@votre-domaine.com'
```

Les appels OpenAI utilisent seulement le message de l'assistant et le contexte de flotte ; les cles restent cote serveur. Les tuiles de carte et les photos distantes demandent une connexion Internet.

## Verification

Services locaux en marche :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Verify.ps1
```

Ce script compile le frontend et l'API, lance les tests Python puis cree une **base de test unique**, demarre une API isolee sur le port 5181 et verifie les parcours reels : authentification, permissions, devis, concurrence de reservations, annulation, contrat, depart, retour, historique apres archivage, tableau de bord et IA. La base de test est supprimee ensuite. La base de l'application est conservee.

Validation effectuee sur ce PC : build React/TypeScript et .NET reussis, **13 tests Python et 61 controles HTTP passes**. Navigation, connexion administrateur, devis avec options et carte des agences verifies dans le navigateur ; mises en page 390 px et 1280 px sans debordement horizontal. Demarrage, arret et redemarrage verifies avec Windows PowerShell 5.1. Les appels externes OpenAI, Cloudinary et SMTP n'ont pas ete executes sans identifiants.

## Arreter et sauvegarder

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Local.ps1
```

L'arret conserve les donnees. `.local/postgres-data` contient la base locale ; sauvegardez-la avec `pg_dump` avant toute suppression de `.local`. Le depot Git conserve le code, pas les donnees ni les secrets.

## Docker et mise en ligne

Docker Desktop n'est pas installe sur ce PC. Les Dockerfiles et `compose.yaml` sont fournis ; leur execution n'est pas validee ici.

```powershell
Copy-Item .env.example .env
# Remplacer DB_PASSWORD et JWT_KEY dans .env avant le lancement
docker compose up --build -d
```

Le site Compose est servi sur http://127.0.0.1:8088. Pour un hebergement public, configurer HTTPS, un domaine, les secrets de production, les origines autorisees et les sauvegardes. Utiliser l'environnement `Production` et provisionner un administrateur sans les comptes de demonstration. Aucun hebergement cloud ni depot GitHub distant n'est cree par ce projet local.

## References officielles

- [PostgreSQL : initialisation du cluster](https://www.postgresql.org/docs/18/app-initdb.html)
- [Docker : PostgreSQL et stockage persistant](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/)
- [VS Code : taches](https://code.visualstudio.com/docs/debugtest/tasks)
- [OpenAI : Responses API](https://platform.openai.com/docs/api-reference/responses)
