import pytest

@pytest.fixture(autouse=True)
def isolate_model_environment(monkeypatch):
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
