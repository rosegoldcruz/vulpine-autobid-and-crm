# AEON service boundary

AEON remains a single server-owned agent/runtime boundary across text, mail, dial, and voice. The subdirectories reserve integration seams without creating separate assistant brains.

`voice/` now contains the server-owned Twilio communications console used by
the Backoffice Communications module. It provides browser calling, SMS/MMS,
call and message history, number management, voicemail, recordings, and
Twilio webhooks. The Backoffice embeds its public HTTPS deployment through
`NEXT_PUBLIC_VOICE_CONSOLE_URL`; Twilio credentials remain in the service.
