# Unified Company & Kuku Management App

This repository now serves both:
The original company marketing site (legacy static HTML in `legacy-bmtc/`).
The Bin Masud Kuku farm management React application (`frontend/`).

## Structure

 `backend/` Express API (MySQL, auth, products, orders, etc.)
 `frontend/` React app (built output served from `backend` under `/kuku` and `/app`)
 `legacy-bmtc/` Static marketing site (served at `/` and `/company`)
## Served Routes

 Landing / legacy site: `http://localhost:5000/` (also `/company`)
 Landing / legacy site: `http://localhost:5000/` (also `/company`)
 React SPA (production build): `http://localhost:5000/kuku` (alias `/app`)
 Login page: `http://localhost:5000/kuku/login`
## Legacy Forms Integration

The static site's forms (`quote` and `contact`) post to PHP endpoints. They were converted to Express endpoints:
# Legacy Forms Integration
The static site's forms (`quote` and `contact`) post to PHP endpoints. They were converted to Express endpoints:
 `POST /forms/contact.php` -> sends email with fields: `name, email, subject, message`
## Mail Configuration

Uses Nodemailer (`backend/utils/email.js`). Environment variables you can set:

# Mail Configuration
Uses Nodemailer (`backend/utils/email.js`). Environment variables you can set:
SMTP_HOST=binmasud.co.ke
SMTP_PORT=465
SMTP_USER=kuku@binmasud.co.ke
SMTP_PASS=Masterofnone052@
## Development

Run backend (ensure MySQL is up if API features needed):
If `CONTACT_MAIL_TO` or `QUOTE_MAIL_TO` are unset they fall back to `SMTP_USER`.

# Development
Run backend (ensure MySQL is up if API features needed):
powershell
cd backend
npm install
npm run dev

Run React app in development (serves on port 3000):
powershell
cd ../frontend
npm install
npm start
In development you may prefer visiting `http://localhost:3000` directly. The production build is what `/kuku` serves after running:
powershell
## Future Improvements

 Replace Multer 1.x with 2.x (security advisories)

Then restart backend to pick up updated build artifacts.

## Deployment Notes

Ensure build output exists (`frontend/build`) before deploying backend. All static legacy files are served directly; consider moving them behind a CDN if traffic grows.
 Add rate limiting & captcha for form submissions
 Create API endpoints for marketing site dynamic content
 Unify navigation (e.g. show Login only when user not authenticated, etc.)

# Deployment Notes
Ensure build output exists (`frontend/build`) before deploying backend. All static legacy files are served directly; consider moving them behind a CDN if traffic grows.
