# Location Ennour : contrats par WhatsApp via n8n (optionnel)

Le mode actif du projet est maintenant manuel, sans Meta. Pour activer ce workflow, definir explicitement DeliveryMode=n8n dans .local/whatsapp-runtime.json puis suivre la configuration ci-dessous.

## Etat et pre-requis

n8n 2.48.5 est installe localement. Le workflow `contract-whatsapp.json` est importe inactif : aucun envoi Meta ne peut se produire avant configuration et publication. L'application WhatsApp Business sur telephone ne fournit pas a elle seule l'API necessaire. Creer un compte Meta Developers, une application avec WhatsApp Cloud API et connecter un numero autorise. Suivre les instructions Meta concernant la coexistence ou la migration d'un numero existant ; ne pas supprimer ou migrer son compte telephone sans verifier ces conditions.

Le workflow envoie un modele WhatsApp approuve contenant la reference et un lien confidentiel vers le contrat complet. Le lien expire apres 7 jours et devient invalide si la reservation est annulee. Le contrat HTML est imprimable/enregistrable en PDF dans le navigateur. Il ne s'agit pas d'un PDF directement joint au message WhatsApp.

## Demarrer

Depuis la racine du projet : `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-N8n.ps1`. Interface : http://localhost:5678 . Creer soi-meme le compte proprietaire n8n dans cette interface. Le service ecoute uniquement sur 127.0.0.1 ; donnees et cle de chiffrement dans `.local/n8n`. Arret : `scripts/Stop-N8n.ps1`. La base et la cle n8n doivent etre sauvegardees ensemble.

## Connexion Meta

1. Dans Meta, obtenir Phone Number ID, Business Account ID et un jeton d'acces approprie. Les numeros de test peuvent uniquement contacter les destinataires autorises dans Meta. Une utilisation commerciale peut impliquer verification et frais Meta.
2. Creer et faire approuver un modele utilitaire nomme `ennour_contract`, langue francaise `fr`, texte : `Votre reservation {{1}} chez Location Ennour a ete acceptee. Votre contrat et les informations de location sont disponibles ici : {{2}}. Ce lien est confidentiel et valable 7 jours.` Aucun envoi libre hors fenetre de conversation : ce workflow utilise toujours le modele approuve.
3. Dans le noeud **Paramètres WhatsApp**, remplacer le Phone Number ID et la version Graph API par les valeurs de l'exemple API affiche par Meta. Adapter templateName et templateLanguage si le modele est different.
4. Dans **Envoyer le contrat sur WhatsApp**, choisir les identifiants **WhatsApp Business Cloud** et y saisir le jeton et le Business Account ID. Ne pas mettre ces secrets dans les fichiers Git ni dans le chat.
5. Le webhook utilise le credential **Location Ennour Webhook**, deja importe, avec le champ `X-Ennour-Webhook-Key`. Sa valeur est locale dans `.local/n8n-webhook-key.txt` et ne doit pas etre publiee.
6. Configurer `.local/whatsapp-runtime.json` : WebhookUrl = URL de production affichee par le noeud webhook, PublicBaseUrl = adresse HTTPS accessible par les clients de l'API Location Ennour, sans chemin. Une URL localhost ne fonctionne pas sur le telephone du client. Aucune ouverture publique ou tunnel n'est cree automatiquement.
7. Publier le workflow, puis redemarrer l'API via Stop-Local.ps1 et Start-Local.ps1. Reessayer les contrats WaitingConfiguration depuis l'espace admin, apres verification des numeros et consentements.

## Fonctionnement et statuts

Le client choisit WhatsApp ou e-mail avant paiement. WhatsApp exige le numero international (+212...), ainsi qu'un consentement explicite. Aucun contrat n'est envoye avant acceptation admin. La file est persistante et utilise un verrou par reservation. n8n ne recoit que le numero, la reference, l'identifiant d'evenement, le consentement et le lien confidentiel, jamais les donnees de carte ou le mot de passe.

L'application considere l'envoi accepte uniquement si n8n renvoie `{"status":"accepted","messageId":"wamid...."}` apres reponse reussie de Meta. Une reponse HTTP 200 generique ne suffit pas. AcceptedByProvider signifie accepte par WhatsApp, sans preuve de reception ou de lecture ; aucun webhook de suivi Meta n'est configure ici. WaitingConfiguration signifie qu'il manque la connexion ou l'adresse HTTPS. Failed est une erreur explicite. Uncertain indique une interruption ambigue : verifier l'execution n8n et Meta avant une relance manuelle afin d'eviter un doublon. Pas de reessai automatique WhatsApp apres une erreur ambigue. L'Idempotency-Key sert de reference de rapprochement ; il ne garantit pas une deduplication chez Meta.

Les executions n8n ne conservent pas les donnees de succes/erreur/manuelles afin d'eviter de stocker les liens confidentiels. Les logs et sauvegardes restent a proteger. Les liens sont des jetons d'acces temporaires, a ne pas transmettre a un tiers.

## Tests effectues

Tests de l'API avec un webhook local simule, aucun message WhatsApp reel : validation numero/consentement avant paiement, identifiant de demande inchange, attente de configuration, authentification du webhook, accusé wamid, lien valable, jeton modifie refuse et lien revoque apres annulation. Le formulaire web/mobile est compile et verifie TypeScript/lint. L'envoi reel et le workflow Meta de bout en bout attendent la creation des identifiants Meta et l'URL HTTPS de l'API.

Sources officielles : https://docs.n8n.io/integrations/builtin/credentials/whatsapp/ et https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ .
