# Service IA Atlas Drive

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
