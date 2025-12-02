# Deploy to cPanel (BMK)

This guide covers two supported deployment models. Option A is recommended.

- Option A — Single Node app: one Node.js app serves legacy site, React build, forms, and APIs.
- Option B — Split: static site under Apache (`public_html`) + Node API on a subdomain (e.g., `api.yourdomain`).

# Prerequisites
 cPanel access with Node.js Application feature (Passenger).
 MySQL credentials (create DB and user in cPanel).
 A mailbox/SMTP credentials for outbound email.

---
# Option A — Single Node App (Recommended)

1)Upload repo
Upload the entire repo directory to a folder like `~/apps/bmk/`.

2)Configure Node App (cPanel → Setup Node.js App)
Application root: `apps/bmk/backend` (point to the `backend` folder).
 Node.js version: 18 or 20.
 Startup file: `server.js`.
 Application mode: `Production`.
 Environment variables (in cPanel UI):
   `PORT=3001`
   `NODE_ENV=production`
   `DB_HOST=localhost`
   `DB_PORT=3306`
   `DB_USER=cpanelprefix_bmkuser`
   `DB_PASSWORD=<db_password>`
   `DB_NAME=cpanelprefix_bmk`
   `JWT_SECRET=<long_random_string>`
   Optional: `RECAPTCHA_SECRET=<server_secret>`
   Optional: `CORS_ORIGIN=<https://yourdomain.tld>` (not needed if same origin)
   SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
 Click `Create` then `Run NPM Install`.

3)Build frontend for production
Build locally (Windows PowerShell example):
``powershell
  cd .\frontend
  $env:REACT_APP_API_URL = "/api"
  npm ci
  npm run build
``
 Upload the generated `frontend/build` to the same repo path on the server (overwrite if present).

4)Domain / URL
In the Node app screen, set your domain/subdomain and base URI `/`.
 Browse:
   `/` → legacy site
   `/kuku` → React app
   `/api/...` → JSON APIs
   Forms post to `/forms/contact.php` and `/forms/quote.php` (handled by Node, not PHP).

---
## Option B — Split Frontend/Backend

1)Static site under Apache (`public_html`)
Upload these from repo root into `public_html/`:
   `index.html`, `about.html`, `services.html`, `Constructions.html`, `contact.html`
   `assets/**` (and its subfolders)
React app (optional):
  Build with the API URL of your subdomain:
    ```powershell
    cd .\frontend
    $env:REACT_APP_API_URL = "https://api.yourdomain.tld/api"
    npm ci
    npm run build
    ```
  Upload `frontend/build/**` to `public_html/kuku/`.
 IMPORTANT: Do not upload `backend/` or `node_modules/` to `public_html`.

2)Node API on subdomain (e.g., `api.yourdomain.tld`)
 Create subdomain in cPanel.
 Setup Node App:
   Application root: `apps/bmk/backend`
   Node version: 18 or 20
   Startup file: `server.js`
   Env vars: set DB, JWT, SMTP, `CORS_ORIGIN=https://yourdomain.tld`
 In your legacy HTML forms, ensure `action` points to the API domain: e.g., `https://api.yourdomain.tld/forms/contact.php`.

---
## MySQL Setup (both options)
1)cPanel → MySQL® Databases
 Create DB: `cpanelprefix_bmk`.
 Create user: `cpanelprefix_bmkuser` and set password.
 Add user to DB with ALL PRIVILEGES.

2)First run
On server start, `backend/config/dbInit.js` creates/patches tables automatically.
 Alternatively, import `backend/database_schema.sql` once, then let auto-init patch as needed.

---
## Email/Forms
 Forms are handled by Node routes (no PHP):
   `POST /forms/contact.php`
   `POST /forms/quote.php`
 Configure SMTP via env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
 Optional: `RECAPTCHA_SECRET` enables verification for form submissions.

---
## Environment File Example
 Use `backend/.env.cpanel.example` as a template (copy to `backend/.env` on the server or paste values into cPanel Node App environment).
 Do not commit real secrets.

---
## Verify & Troubleshoot
 Logs (cPanel Node App) should show:
   Server started, legacy root path, React build paths
   `✉️ SMTP connection verified` if SMTP is correct
 Common issues:
   Wrong Application root (must be `backend`)
   React built with wrong `REACT_APP_API_URL`
   Missing DB prefixes in env vars (`cpanelprefix_...`)
   CORS blocked (set `CORS_ORIGIN` if split deployment)
   PHP forms in `public_html` (remove when using Node handlers)

---
## GitHub → cPanel Auto-Deploy
You have a few options:
 cPanel Git™ Version Control (if available):
   Create a repo in cPanel UI, connect to your GitHub repo via SSH/HTTPS.
   Set the Deployment script to run `npm ci` and (optionally) `npm run build` (for frontend) and then restart the Node app via Passenger (touch `tmp/restart.txt`).
 GitHub Actions (recommended):
   Create a workflow that on push to main:
    - Builds the frontend with `REACT_APP_API_URL=/api`.
    - Rsync/SCPs changed files to your cPanel app directory via SSH.
    - Runs `npm ci` in `backend` and restarts the app by touching `tmp/restart.txt`.
 cPanel Deployment via Webhooks:
   Some hosts support auto-deploy hooks that pull the latest changes. Check your provider’s docs.

Example deploy step (server side) to restart Passenger:
``bash
mkdir -p tmp && touch tmp/restart.txt
``

Note: For security, store secrets (SSH key, SMTP, DB) in GitHub Actions Secrets; do not commit them.
