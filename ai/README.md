# Service IA Location Ennour

Python 3.13+, FastAPI et scikit-learn. Démarrage depuis ce dossier :

```powershell
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8101
```

Documentation interactive : `http://127.0.0.1:8101/docs`. Le service doit rester privé, derrière l'API ASP.NET Core ; il ne gère pas les sessions clients.

`POST /recommendations` reçoit `{budget, passengers, category?, vehicles: [...]}`. Le budget est journalier en MAD. Il exclut les véhicules en maintenance, trop chers ou trop petits, puis classe jusqu'à trois véhicules avec un index de voisins proches scikit-learn sur les caractéristiques normalisées de la flotte reçue. Il n'existe pas de données d'entraînement synthétiques ni de promesse de personnalisation apprise. La catégorie est une préférence ; le budget et les places sont des contraintes strictes. La disponibilité aux dates doit être filtrée par l'API ou revérifiée à la réservation.

`POST /chat` reçoit `{message, context?}` et répond `{reply, source}`. Sans clé, les réponses sont des explications locales préécrites (`source: local`) : ce mode ne fait pas d'appel à un modèle. Pour l'assistance OpenAI, configurez les variables serveur `OPENAI_API_KEY` et facultativement `OPENAI_MODEL` (défaut : `gpt-5.4-mini`). Aucun secret ne va dans le frontend. L'appel utilise Responses API avec `store=False`, ce qui désactive le stockage de la réponse pour récupération ultérieure via l'API, et ne possède aucun outil permettant de modifier une réservation. Une panne retourne une aide locale avec `source: local-fallback`.

Seuls les champs publics des tableaux `context.vehicles` et `context.locations` sont retenus ; les autres données de contexte sont ignorées. Le texte du message est envoyé à OpenAI uniquement lorsque la clé est configurée. N'y saisissez pas de données sensibles.

Tests : `python -m pytest tests -q`.

Références officielles : [OpenAI Python SDK](https://developers.openai.com/api/reference/python), [Responses API](https://developers.openai.com/api/reference/python/resources/responses/methods/create), [FastAPI Request Body](https://fastapi.tiangolo.com/tutorial/body/), [scikit-learn NearestNeighbors](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html).

## Discussion multilingue

Le chatbot accepte les questions generales, les traductions et les questions sur la flotte. Il reprend les 12 derniers messages (24 000 caracteres maximum) de la session courante, sans les conserver en base. Les roles systeme et outil fournis par un client sont refuses. Le catalogue reste une source de donnees, jamais une instruction.

Deux moteurs : OpenAI si OPENAI_API_KEY est configuree, sinon Ollama si OLLAMA_MODEL est defini. Pour Ollama : installer depuis ollama.com, lancer `ollama pull qwen3:4b-instruct`, puis definir OLLAMA_MODEL=qwen3:4b-instruct et OLLAMA_BASE_URL=http://127.0.0.1:11434. Pour le lanceur Windows, creer .local/chat-runtime.json contenant {"model":"qwen3:4b-instruct"}. Start-Local lance le moteur si necessaire. Les fichiers .local et les conversations ne sont pas publies dans Git.

Sans moteur ou en cas de panne, la FAQ limitee est affichee comme mode secours. Le modele n'a pas de navigation Internet en direct ni d'outil pour modifier les reservations. La qualite des langues varie selon le modele. Aucun modele ne garantit une reponse correcte a toute question.

Sur ce PC, OLLAMA_NUM_GPU=0 utilise le processeur. Ce reglage peut etre adapte sur une machine avec GPU recent.

## Affichage progressif et latence

Le site et le mobile utilisent POST /api/chat/stream (NDJSON : delta/source, puis done, ou error). L'API ASP.NET transmet les fragments sans attendre la fin du texte. Ollama reste charge 30 minutes apres un echange ; le premier appel apres dechargement peut donc etre plus lent. Les questions generales ne recoivent ni catalogue ni conditions de location ; le contexte recent est limite aux huit derniers messages. Les reponses locales sont limitees a 240 tokens. Le chemin OpenAI et le secours restent compatibles, avec une reponse complete sur cette route.

Mesures locales du 18 novembre 2026, modele deja disponible, deux questions : premiers mots en 2,45 s et 1,25 s, reponses completes en 6,73 s et 2,15 s. Ces mesures ne garantissent pas la meme latence pour les longs historiques, les questions de location ou le premier chargement du modele. Affichage progressif verifie dans React Native Web ; aucun appareil physique Android/iOS teste pour ce changement.
