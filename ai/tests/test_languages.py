import pytest
from fastapi.testclient import TestClient
import main

@pytest.mark.parametrize('message,expected', [
    ('How much is insurance?', 'Welcome'), ('Hola, quiero un coche', 'Bienvenido'),
    ('Hallo, wie viel kostet ein Auto?', 'Willkommen'), ('Ciao quanto costa?', 'Benvenuto'),
    ('Olá quero alugar', 'Bem-vindo'), ('بغيت نكري طوموبيل', 'مرحبا بيك'),
    ('ما هي الأسعار؟', 'مرحبا بك'),
])
def test_offline_language_detection(monkeypatch, message, expected):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    reply = TestClient(main.app).post('/chat', json={'message': message}).json()
    assert reply['source'] == 'local'
    assert expected in reply['reply']
    assert '90' in reply['reply']

def test_explicit_language_preference(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    reply = TestClient(main.app).post('/chat', json={'message': 'Bonjour', 'language': 'en'}).json()
    assert 'Welcome' in reply['reply']
