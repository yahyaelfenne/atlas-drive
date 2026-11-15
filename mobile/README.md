# Location Ennour mobile

Application React Native + TypeScript pour Android et iPhone, avec Expo SDK 58 et Expo Router. Elle utilise la même API ASP.NET Core et la même base PostgreSQL que le site.

## Tester sur votre téléphone

Dans VS Code, ouvrez `Terminal > Run Task > Location Ennour: application mobile`. Ou, depuis le dossier racine du projet, lancez

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Mobile.ps1
```

Pour une première installation des dépendances mobiles, ajoutez `-Install`.

1. Installez Expo Go sur Android ou iPhone, dans une version compatible SDK 58.
2. Connectez le téléphone et le PC au même Wi-Fi.
3. Scannez le QR code affiché par Expo dans le terminal. Sur iPhone, utilisez l’appareil photo. Sur Android, utilisez Expo Go.
4. Si iOS demande l’accès au réseau local, autorisez-le pour cette connexion au PC.

Le script démarre les services existants puis un proxy de développement sur le port **5182**, accessible sur le réseau local. Il transmet les requêtes à l’API locale du PC sur **5180**. L’authentification et les rôles restent vérifiés par cette API. Aucune règle de pare-feu n’est créée automatiquement. Le téléphone doit pouvoir joindre le port 5182 du PC et Metro sur 8081.

Dans **Mon compte > Connexion au serveur**, vous pouvez modifier l’adresse et tester la connexion. Utilisez par exemple `http://192.168.1.4:5182`, selon l’adresse Wi-Fi affichée par le script. Sur un émulateur Android, utilisez `http://10.0.2.2:5182`. Un tunnel Expo ne publie pas automatiquement l’API.

Le fichier `.env.local`, ignoré par Git, peut définir `EXPO_PUBLIC_API_URL`. La valeur est une adresse publique de serveur, jamais une clé secrète. Le stockage de la session utilise SecureStore sur Android/iOS et sessionStorage pour l’aperçu navigateur.

## Parcours disponibles

- Accueil, catalogue, recherche, villes, catégories, transmission, budget et disponibilité par dates.
- Fiche voiture, dates natives, agences, protection et options, devis calculé par le serveur.
- Connexion et inscription ; saisie de carte TEST et paiement simulé avant l’envoi de la demande ; blocage immédiat des dates ; validation admin ; annulation avec remboursement simulé et contrat PDF après acceptation. Cartes de test : 4242 4242 4242 4242 acceptée ou 4000 0000 0000 0002 refusée, expiration future MM/AA et CVC 123. Ne jamais utiliser de vraie carte. Aucun numéro ou CVC enregistré.
- Agences et ouverture d’OpenStreetMap.
- Recommandations scikit-learn et assistant, avec indication de sa source locale ou OpenAI.
- Admin : Locations pour accepter/refuser les demandes clients et suivre les départs/retours ; Voitures pour ajouter/modifier/supprimer ; Agences pour ajouter/modifier/supprimer les bureaux et leurs coordonnées GPS. Le compte admin ne peut ni louer ni payer une location.
- Ajout, modification et archivage des véhicules. Les photos sont renseignées par URL HTTPS.

Les données initiales sont fictives. Les comptes de démonstration locaux sont `admin@atlasdrive.ma` / `AtlasAdmin2026!` et `client@atlasdrive.ma` / `AtlasClient2026!`. OpenAI, Cloudinary et SMTP dépendent de la configuration du backend existant.

## Aperçu et vérification

```powershell
# Depuis la racine
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Mobile.ps1 -Web

# Depuis mobile/
npm run typecheck
npm run lint
npm run export
npx expo-doctor
```

L’aperçu React Native Web sur `http://localhost:8081` sert à vérifier les écrans et les échanges API. Sur téléphone, les dates et le partage PDF utilisent les composants natifs. L’aperçu web permet de télécharger le contrat en HTML.

Pour arrêter le serveur Expo, utilisez Ctrl+C dans son terminal. `scripts/Stop-Mobile.ps1` arrête le proxy mobile. Les services du site se contrôlent avec les scripts existants.

## Générer les applications installables

Les profils `eas.json` préparent un APK Android interne, une version pour simulateur iOS et les versions de distribution. Les identifiants de package proposés sont `ma.atlasdrive.mobile` et peuvent être adaptés avant la première publication.

Configurez d’abord une API accessible en HTTPS, puis définissez `EXPO_PUBLIC_API_URL` dans votre environnement Expo Build. Le profil de compilation refuse une adresse absente ou HTTP pour les versions installables. Les données de développement du PC ne sont pas embarquées dans l’application.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
```

La compilation cloud nécessite votre compte Expo. La signature et la distribution iPhone nécessitent vos identifiants Apple Developer. Sur ce PC Windows, aucun simulateur iOS ou SDK Android n’est installé. Les exports JavaScript Android/iOS et l’aperçu navigateur peuvent être vérifiés ici. Les binaires APK/IPA et les essais sur appareils physiques nécessitent l’environnement de compilation et les appareils correspondants.

Références officielles — [Expo Go](https://expo.dev/go), [environnement de développement](https://docs.expo.dev/get-started/set-up-your-environment/), [compilation des applications](https://docs.expo.dev/build/setup/).


Le catalogue contient 14 modèles et des photographies réelles illustratives provenant de Wikimedia Commons. Les crédits sont accessibles depuis Mon compte. Le chatbot détecte la langue et propose un choix explicite : français, darija, arabe, anglais, espagnol, allemand, italien et portugais en mode local. Les autres langues sont prises en charge par le mode OpenAI, qui nécessite OPENAI_API_KEY sur le serveur. Aucune clé ne doit être placée dans l’application mobile.
