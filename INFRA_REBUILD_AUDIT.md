# Vulpine Command Center — Infrastructure Rebuild Audit

Date: 2026-06-22
Server: CX53-Vulpine-32GB-320GB
Repo: /opt/vulpine-command-center
Commit: 6d54e86
Branch: main
Remote: git@github.com:rosegoldcruz/vulpine-autobid-and-crm.git

## Existing Env Files Found

| File | Path | Status |
|------|------|--------|
| `.env` | /opt/vulpine-command-center/.env | **Legacy**. Contains 70+ keys from previous infrastructure. Should not be loaded by the new backend service. |
| `services/api/.env` | does not exist | Needs creation |
| `services/api/.env.example` | does not exist | Needs creation |
| `.env.example` | does not exist | Needs creation |

## Env Keys Found in Legacy .env (keys only, no values)

```
APP_BASE_URL
AUTH_SECRET
AUTH_URL
BOOTSTRAP_ADMIN_EMAIL
Brand_registration_SID
Campaign_SID
Campaign_status
Campaign_use_case
Compliance_Registration_SID
Connected_Messaging_Service_1
Connected_Messaging_Service_2
Connected_Messaging_Service_3
DATABASE_URL
DEEPSEEK_API_KEY
DIAL_PROVIDER
EMAIL_CRON_SECRET
EMAIL_DEFAULT_FROM
EMAIL_DEFAULT_FROM_NAME
EMAIL_DRY_RUN
EMAIL_PROVIDER
EMAIL_WEBHOOK_SECRET
External_Campaign_ID
FALLBACK_DIAL_PROVIDER
GITHUB_TOKEN
Linked_Messaging_Service
N8N_API_KEY
N8N_WEBHOOK_URL
NEXTAUTH_URL
NOCODB_DATABASE_URL
Phone_number_1
Phone_number_2
Phone_number_3
Phone_number_SID_1
Phone_number_SID_2
Phone_number_SID_3
PORT
SEND_LAYER_PROVIDER
SMTP_FROM
SMTP_HOST
SMTP_PASS
SMTP_PORT
SMTP_REPLY_TO
SMTP_SECURE
SMTP_USER
TELNYX_API_KEY
TELNYX_CONNECTION_ID
TELNYX_OUTBOUND_NUMBER
TELNYX_SIP_DOMAIN
TELNYX_WEBHOOK_URL
Trunk_SID
TWILIO_ACCOUNT_SID
TWILIO_API_KEY
TWILIO_API_KEY_SID
TWILIO_API_SECRET
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_STATUS_CALLBACK_URL
TWILIO_TWIML_APP_SID
TWILIO_VOICE_REQUEST_URL
VULPINE_CRM_INTAKE_URL
VULPINE_SUPPLY_INTAKE_TOKEN
XAI_GROK_API_KEY
ZITADEL_CLIENT_ID
ZITADEL_CLIENT_SECRET
ZITADEL_ISSUER
```

## Env Keys Required by Frontend Code

| Key | Source file | Status |
|-----|-------------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `lib/api-client.ts` line 14 | **Missing**. Not set anywhere for production. Frontend will throw at request time. |

## Env Keys Required by services/api Code

| Key | Source file | Status |
|-----|-------------|--------|
| `PORT` | `services/api/server.js` line 12,265-267 | **Missing**. Default fallback is 3001, but `requiredEnv("PORT")` is called at module start. |
| `DATABASE_URL` | `services/api/db.js` line 27 | **Missing**. Will fail at first SQL call. |
| `CORS_ALLOWED_ORIGINS` | `services/api/server.js` line 30 | **Missing**. Has empty fallback. |
| `STORAGE_ROOT` | `services/api/fileStorage.js` line 19 | **Missing**. Will fail at first file storage call. |

## Env Keys Required by Zitadel Auth Code

**No Zitadel integration code found in the repository.** The existing codebase has no next-auth, no Zitadel SDK, no auth middleware, and no protected routes. Auth is a placeholder only.

Existing Zitadel keys in legacy `.env` (preserve if Zitadel tenant remains valid):
- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_CLIENT_SECRET`

These should be preserved exactly as-is unless the tenant/application has been recreated.

## Env Keys Required by NocoDB Integration

**No NocoDB integration code found in the repository.**

Legacy key found: `NOCODB_DATABASE_URL`

## Env Keys Required by n8n Integration

**No n8n integration code found in the repository.**

Legacy keys found: `N8N_API_KEY`, `N8N_WEBHOOK_URL`

## Values Present vs Missing

### Present (in legacy .env)
All 70+ keys have values. However, many refer to old infrastructure. The following should be preserved:
- `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` — if Zitadel tenant is still active.

### Missing (never created)
- `NEXT_PUBLIC_API_BASE_URL` — must be set in Vercel env.
- Fresh `DATABASE_URL` — old value may be invalid. Regenerate.
- `PORT` — old value was for different service. Set to `4000`.
- `CORS_ALLOWED_ORIGINS` — set fresh.
- `STORAGE_ROOT` — set fresh.
- `services/api/.env` — does not exist. Must be created.

## Values to Regenerate Fresh

| Key | Reason |
|-----|--------|
| `DATABASE_URL` | New Postgres database and user. |
| `PORT` | New backend service on 4000. |
| `CORS_ALLOWED_ORIGINS` | Fresh origins list. |
| `STORAGE_ROOT` | Fresh upload directory. |
| Database password | New openssl-generated password. |
| NocoDB credentials | Fresh deployment with new credentials. |
| n8n credentials | Fresh deployment with new credentials. |

## Values to Preserve from Zitadel

| Key | Reason |
|-----|--------|
| `ZITADEL_ISSUER` | Existing Zitadel tenant must stay. |
| `ZITADEL_CLIENT_ID` | Existing Zitadel application must stay. |
| `ZITADEL_CLIENT_SECRET` | If still valid, preserve. If lost, regenerate in Zitadel console. |

## Service Status

| Service | Installed | Running | Notes |
|---------|-----------|---------|-------|
| Postgres server | **No** | No | Only client packages installed. Server must be installed. |
| Docker | Yes (29.6.0) | Yes | Compose v5.1.4 available. No containers running. |
| nginx | **No** | No | Must be installed. |
| PM2 | **No** | No | Must be installed via npm. |
| Node.js | Yes (v24.17.0) | N/A | npm 11.13.0 available. |
| certbot | **No** | No | Must be installed for SSL. |
| Zitadel | Unknown | Unknown | Tenant exists externally. Local code has no integration yet. |
| NocoDB | Not deployed | No | Fresh Docker Compose needed. |
| n8n | Not deployed | No | Fresh Docker Compose needed. |

## Zitadel Callback URLs Required

Since no auth code exists yet in the repo, these are the URLs that would need to be configured in Zitadel when auth is wired:

```
https://crm.vulpinehomes.com/api/auth/callback/zitadel
https://api.vulpinehomes.com/api/auth/callback/zitadel
http://localhost:3000/api/auth/callback/zitadel
```

## Frontend Routes Protected

None. Auth middleware not implemented.

## Backend Endpoints Protected

None. The API has no auth verification layer yet.
