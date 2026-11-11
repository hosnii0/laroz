LAROZ BACKEND UPDATE - HELLO WORLD TEST MODE

This backend has a manually triggered, protected endpoint:
POST /api/test/hello-world
It sends Meta's pre-approved hello_world template (en_US) to WHATSAPP_TO.
It is NOT triggered by checkout. It does not send order details.

Render Environment Variables:
WHATSAPP_TOKEN = your newly generated token (Render only; never GitHub/chat)
PHONE_NUMBER_ID = 1366379429899651 (test sender ID)
WHATSAPP_TO = your verified test recipient number, digits only with country code
META_API_VERSION = v25.0
ALLOWED_ORIGINS = https://hosnii0.github.io
TEST_ENDPOINT_KEY = a long random secret you create; don't commit or share it
HELLO_TEST_COOLDOWN_MS = 60000
ENABLE_ORDER_SENDING = false
WHATSAPP_TEMPLATE_NAME = laroz_new_order
WHATSAPP_TEMPLATE_LANGUAGE = en

Manual test from Windows PowerShell after Render deploys:
$api = 'https://YOUR-RENDER-SERVICE.onrender.com'
$key = Read-Host 'Enter TEST_ENDPOINT_KEY'
$headers = @{ 'x-test-key' = $key }
Invoke-RestMethod -Method Post -Uri "$api/api/test/hello-world" -Headers $headers

The endpoint is manual, requires the secret header, and enforces a 60-second cooldown.
No message is sent on server startup, health checks, or normal customer checkout.

When laroz_new_order becomes Approved, change ENABLE_ORDER_SENDING to true in Render.
Then redeploy the service. Keep WHATSAPP_TEMPLATE_NAME=laroz_new_order and language=en.
