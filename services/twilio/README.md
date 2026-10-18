# Twilio SMS / Voice Console

A self-hosted web app that replaces the "VirtualSMS"-style Android app: manage
Twilio accounts and phone numbers, run bulk SMS/MMS campaigns with per-second
rate limiting, use a full browser softphone, send one-to-one SMS/MMS, inspect
authoritative call/message history, and handle inbound calls/texts with
auto-reply, forwarding, recordings, missed-call alerts, and voicemail — all
through your own Twilio credentials on your own server.

## Features

- **Accounts** — store multiple Twilio accounts (SID + auth token, encrypted
  at rest with Fernet). Masked in the UI like `ACcb****`. One-click
  connection test.
- **Browser phone** — make and answer calls with Twilio Voice JavaScript SDK
  2.18.3, choose an owned caller ID, mute, send keypad tones, and optionally
  record. One-click setup creates the required TwiML App and Standard API key;
  the browser receives only a short-lived one-hour access token.
- **Messages** — send one-to-one SMS/MMS and browse Twilio's live inbound and
  outbound history, delivery status, errors, and media count.
- **Calls** — browse Twilio's live inbound and outbound call history with
  status, direction, duration, time, and price where available.
- **Numbers** — live list of your Twilio numbers with SMS/voice capabilities,
  set default sender, search & buy numbers by area code, release numbers, and
  one-click **Apply webhooks** that points a number's Voice/SMS URLs at this
  app.
- **Campaigns** — bulk SMS/MMS: name, account, from-number, message, optional
  media URLs, recipients via pasted list or CSV, messages/sec override.
  Preview/confirm screen, then a background worker sends at the throttled
  rate. Per-recipient delivery status updates via Twilio status callbacks.
- **Messaging settings** — global default max SMS/sec.
- **Call settings (per number)** — ring the browser first, forwarding on/off +
  target, record calls, missed-call SMS alert + notify number.
- **Voicemail (per number)** — on/off + custom greeting; inbox with audio
  playback (proxied through the backend — raw Twilio URLs never reach the
  browser), transcription display, delete.
- **Auto-reply (per number)** — on/off + reply text; inbound SMS inbox.
- **Recordings** — browse call recordings per account, play, delete.
- **Webhooks** — public endpoints with strict `X-Twilio-Signature`
  validation against the account's auth token.

## Quick start (Docker, recommended for a VPS)

```bash
cd twilio-app
cp .env.example .env
# Edit .env: set ADMIN_PASSWORD, PUBLIC_BASE_URL, ENCRYPTION_KEY
# Generate the encryption key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

docker compose up -d --build
# Put HTTPS in front of port 8080, then open your PUBLIC_BASE_URL.
```

## Quick start (local Python)

```bash
cd twilio-app
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit it
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Pointing Twilio at this app (webhooks)

Inbound SMS, calls, voicemail, and delivery receipts only work if Twilio can
reach this app over public HTTPS:

1. Put the app behind HTTPS (reverse proxy like Caddy/Nginx, or Cloudflare
   Tunnel) and set `PUBLIC_BASE_URL=https://sms.yourdomain.com` in `.env`.
   Signature validation reconstructs this exact URL, so it must match what
   Twilio calls — including `https://`.
2. In the app, go to **Numbers → Apply webhooks** on each number. This sets:
   - `SmsUrl = {PUBLIC_BASE_URL}/webhooks/sms` (POST)
   - `VoiceUrl = {PUBLIC_BASE_URL}/webhooks/voice` (POST)

   (Buying a number through the app applies these automatically.) You can
   also set the same URLs manually in the Twilio Console under
   Phone Numbers → Manage → Active numbers.

3. Test: text the number (auto-reply), call it (forwarding/voicemail), and
   watch the Messages / Voicemail tabs.

## Enable browser calling

1. Complete the HTTPS/webhook setup above and sync your Twilio numbers.
2. Open **Phone**, select the account, and click **Set up browser calling**.
   The server creates/updates a TwiML App whose Voice URL is
   `{PUBLIC_BASE_URL}/webhooks/browser-voice`, creates a Standard API key when
   needed, and encrypts its one-time secret immediately.
3. Click **Enable phone** and allow microphone access. You can now call an
   E.164 number such as `+16025551234` from an owned voice-capable caller ID.
4. To receive calls in the browser, open **Numbers → Configure**, enable
   **Ring browser phone first**, and keep the Phone page enabled. Missed browser
   calls fall through to voicemail or the unavailable message.

Current Chrome, Firefox, Safari, and Edge can place calls from a browser.
Twilio supports Chrome/Firefox on Android and Chrome/Firefox/Safari on iOS.
On mobile, keep the page open for the call; native Voice SDK apps remain the
better choice for reliable background ringing and push notifications.

## How the call flow works

- **Browser ringing on** → the active browser phone rings first; unanswered
  calls fall through to voicemail or the unavailable message.
- **Forwarding on** → caller is `<Dial>`ed to your target (recorded if
  enabled). If the forwarded leg gets no-answer/busy/failed and missed-call
  alerts are on, you get an SMS.
- **Forwarding off, voicemail on** → greeting plays, caller records up to
  3 minutes, Twilio transcribes it, and it lands in the Voicemail inbox.
- **Both off** → polite "not available" + hangup.

## Security notes

- Single admin login (`ADMIN_PASSWORD`); session cookie is signed, HttpOnly,
  SameSite=Lax, and Secure whenever `PUBLIC_BASE_URL` uses HTTPS.
- Auth tokens are Fernet-encrypted in SQLite and decrypted only in memory,
  server-side, when calling Twilio. The API never returns tokens (masked
  `xxxx****` hints only), and request logging excludes auth headers/bodies.
- Webhook endpoints are public by necessity but reject any request without a
  valid Twilio signature.
- Browser Voice access tokens expire after one hour. Twilio API-key secrets
  are encrypted at rest and never returned to the browser.
- Back up `data/twilio_app.db` and keep your `.env` (especially
  `ENCRYPTION_KEY`) somewhere safe — losing the key means re-entering tokens.

## Compliance note (US bulk SMS)

Sending bulk/marketing SMS from US 10-digit numbers requires **A2P 10DLC
registration** with Twilio (brand + campaign approval), otherwise carriers
filter or block the traffic and Twilio may suspend the number. Register in
the Twilio Console under Messaging → Regulatory Compliance → A2P 10DLC
*before* launching campaigns. Transactional/operational messages have
lighter requirements but still benefit from registration. This app does not
bypass any carrier rules — the rate limiter only paces your sends.

## Project layout

```
twilio-app/
├── app/
│   ├── main.py            # FastAPI app, auth endpoints, startup, static mount
│   ├── config.py          # env-based configuration
│   ├── db.py              # SQLAlchemy engine/session
│   ├── models.py          # accounts, numbers, settings, campaigns, inbox...
│   ├── crypto.py          # Fernet encrypt/decrypt + masking helpers
│   ├── auth.py            # admin password + signed session cookie
│   ├── twilio_client.py   # Twilio client factory, webhook URL, sig validation
│   ├── worker.py          # asyncio campaign sender (per-second throttle)
│   ├── webhooks.py        # public Twilio webhooks (sms/voice/call-status/...)
│   └── routers/
│       ├── accounts.py    # CRUD + test connection
│       ├── numbers.py     # list/buy/release/apply-webhooks
│       ├── settings.py    # global + per-number settings
│       ├── campaigns.py   # create/preview/launch/cancel
│       ├── messages.py    # live SMS/MMS history + one-to-one sending
│       ├── voice.py       # Voice SDK provisioning/tokens + call history
│       ├── voicemails.py  # voicemail inbox + audio proxy
│       └── recordings.py  # call recordings browser + audio proxy
├── static/
│   ├── index.html         # single-page UI
│   ├── app.js             # frontend logic (no build step)
│   ├── styles.css         # dark theme
│   └── vendor/            # pinned Twilio Voice JS SDK + license
├── tests/                 # API/security regression tests
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
