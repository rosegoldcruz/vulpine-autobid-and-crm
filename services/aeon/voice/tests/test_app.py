from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import db, twilio_client
from app.crypto import encrypt_token
from app.main import app
from app.models import Account, PhoneNumberCache


@pytest.fixture(autouse=True)
def clean_database():
    db.engine.dispose()
    db.Base.metadata.drop_all(bind=db.engine)
    db.init_db()
    yield
    db.SessionLocal.remove() if hasattr(db.SessionLocal, "remove") else None


@pytest.fixture
def client():
    with TestClient(app, base_url="https://testserver") as test_client:
        response = test_client.post("/api/auth/login", json={"password": "test-password"})
        assert response.status_code == 200
        yield test_client


def add_voice_account(*, configured=True):
    session = db.SessionLocal()
    account = Account(
        label="Test Twilio",
        account_sid="AC" + "1" * 32,
        encrypted_token=encrypt_token("auth-secret"),
        api_key_sid=("SK" + "2" * 32) if configured else "",
        encrypted_api_secret=encrypt_token("a" * 40) if configured else "",
        twiml_app_sid=("AP" + "3" * 32) if configured else "",
        voice_identity="backoffice",
        is_default=True,
    )
    session.add(account)
    session.flush()
    number = PhoneNumberCache(
        account_id=account.id,
        number_sid="PN" + "4" * 32,
        phone_number="+16025550100",
        sms_capable=True,
        voice_capable=True,
        is_default_sender=True,
    )
    session.add(number)
    session.commit()
    result = account.id
    session.close()
    return result


def test_voice_token_is_short_lived_and_does_not_expose_secrets(client):
    account_id = add_voice_account()
    response = client.post("/api/voice/token", json={"account_id": account_id})
    assert response.status_code == 200
    body = response.json()
    assert body["token"].count(".") == 2
    assert body["expires_in"] == 3600
    assert body["caller_numbers"] == ["+16025550100"]
    assert "auth-secret" not in response.text
    assert "a" * 40 not in response.text


def test_voice_token_requires_provisioning(client):
    account_id = add_voice_account(configured=False)
    response = client.post("/api/voice/token", json={"account_id": account_id})
    assert response.status_code == 409


def test_one_to_one_sms_uses_owned_sender(client, monkeypatch):
    account_id = add_voice_account()
    created = {}

    class Messages:
        def create(self, **kwargs):
            created.update(kwargs)
            return SimpleNamespace(
                sid="SM" + "5" * 32,
                status="queued",
                from_=kwargs["from_"],
                to=kwargs["to"],
            )

    monkeypatch.setattr(
        twilio_client,
        "get_client",
        lambda _account: SimpleNamespace(messages=Messages()),
    )
    response = client.post("/api/messages/send", json={
        "account_id": account_id,
        "from_number": "+16025550100",
        "to_number": "+16025550101",
        "body": "Hello from the browser",
        "media_urls": [],
    })
    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    assert created["from_"] == "+16025550100"


def test_one_to_one_sms_rejects_unowned_sender(client):
    account_id = add_voice_account()
    response = client.post("/api/messages/send", json={
        "account_id": account_id,
        "from_number": "+16025550999",
        "to_number": "+16025550101",
        "body": "Nope",
    })
    assert response.status_code == 400


def test_browser_voice_webhook_dials_with_owned_caller_id(client, monkeypatch):
    add_voice_account()
    monkeypatch.setattr(twilio_client, "validate_signature", lambda *_args: True)
    response = client.post(
        "/webhooks/browser-voice",
        data={
            "AccountSid": "AC" + "1" * 32,
            "To": "+16025550101",
            "FromNumber": "+16025550100",
            "Record": "true",
        },
        headers={"X-Twilio-Signature": "test"},
    )
    assert response.status_code == 200
    assert '<Dial answerOnBridge="true" callerId="+16025550100"' in response.text
    assert 'record="record-from-answer-dual"' in response.text
    assert "<Number>+16025550101</Number>" in response.text
