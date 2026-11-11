# Laroz – website + WhatsApp order API

This package contains the current Laroz menu website and a small Node.js API. It does not use a database.

## Important before going live

- The WhatsApp template `laroz_new_order` must be **Approved** in WhatsApp Manager. `In Review` is not sufficient.
- Create/rotate a fresh WhatsApp access token and revoke the token previously exposed. Put the new token only in Render Environment Variables. Never put it in `index.html`, GitHub, or this ZIP.
- For test mode, `PHONE_NUMBER_ID` is the test sender Number ID shown in Meta API Setup; `WHATSAPP_TO` is a recipient number that you added and verified in Meta, including country code and digits only. These are two different numbers.
- Confirm menu names/prices marked for review with the cafe before accepting real orders.
- The website shows an in-page success screen only after Meta returns a WhatsApp message ID. It does not guarantee the cafe has read or acted on the message.
- No database is used. Order IDs are generated in the browser and orders are not stored as a permanent order history.

## 1) Deploy the API on Render

1. Create a GitHub repository and upload the contents of this folder to its root.
2. In Render, create a **New Web Service** and connect that repository.
3. Render should detect `render.yaml`; otherwise use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. In Render → Environment, add:
   - `WHATSAPP_TOKEN`: a fresh token (secret)
   - `PHONE_NUMBER_ID`: `1366379429899651` only if this is still the intended test/production sender number
   - `WHATSAPP_TO`: the cafe recipient number in international digits-only format
   - `WHATSAPP_TEMPLATE_NAME`: `laroz_new_order`
   - `WHATSAPP_TEMPLATE_LANGUAGE`: `en`
   - `META_API_VERSION`: `v25.0`
   - `ALLOWED_ORIGINS`: exact GitHub Pages origin, e.g. `https://YOUR_GITHUB_NAME.github.io`
5. Deploy. Open `https://YOUR-RENDER-SERVICE.onrender.com/health`; it should return `{"ok":true,...}`.

## 2) Configure the website API URL

In `index.html`, find `apiBaseUrl` in `CONFIG` and replace:

`https://YOUR-RENDER-SERVICE.onrender.com`

with your actual Render service URL (no trailing slash required).

Also make sure the exact website origin is included in Render's `ALLOWED_ORIGINS`, then redeploy the API if you changed it.

## 3) Publish the website with GitHub Pages

1. In the GitHub repository, open Settings → Pages.
2. Under Build and deployment, choose Deploy from a branch.
3. Select `main` and `/ (root)`, then Save.
4. Wait for GitHub Pages to publish. The URL is usually `https://YOUR_GITHUB_NAME.github.io/REPOSITORY_NAME/`.
5. If you publish under a repository path, the browser origin is still `https://YOUR_GITHUB_NAME.github.io`; use that origin in `ALLOWED_ORIGINS`.

## 4) Test safely

1. Test `/health`.
2. Open the GitHub Pages site from a phone using mobile data (not the same Wi-Fi).
3. Add a low-cost test order and submit it only to a number you control / have permission to test.
4. Confirm the WhatsApp template message arrives and the website shows the success screen.
5. Test a failed send (e.g. temporarily remove a test token in Render) and confirm the cart remains intact and no success screen appears.

## WhatsApp template mapping

The API sends seven body parameters in this order:

1. Order ID
2. Customer name
3. Order type (`Pickup` / `Delivery`)
4. Items summary (`2x Latte, 1x Waffle`)
5. Total (`250.00 EGP`)
6. Delivery address or `-`
7. Notes (or `No notes`)

This matches the seven placeholders visible in the submitted `laroz_new_order` template. The current template has no customer-phone placeholder, so this version does not collect a phone number in checkout. If the cafe needs the customer phone in the WhatsApp message, add a dedicated placeholder to a revised template and wait for Meta approval before changing the API mapping.

## Free hosting limitations

Render free web services can sleep after inactivity and may take time to wake on the next request. GitHub Pages hosts only the static website; the API must remain on a separate Node-capable host.
