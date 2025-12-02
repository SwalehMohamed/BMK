# Unified Company & Kuku Management App

This repository serves both:
- The original company marketing site (legacy static HTML in `legacy-bmtc/`).
- The Bin Masud Kuku farm management React application (`frontend/`).

## Structure

- `backend/` Express API (MySQL, auth, products, orders, etc.)
- `frontend/` React app (build served from `backend` under `/kuku` and `/app`).
- `legacy-bmtc/` Static marketing site (served at `/` and `/company`).

## Served Routes

- Landing / legacy site: `http://localhost:5000/` (also `/company`).
- React SPA (production build): `http://localhost:5000/kuku` (alias `/app`).
- Login page: `http://localhost:5000/kuku/login`.
- Legacy projects pages: e.g. `http://localhost:5000/projects.html`.

## Legacy Forms Integration

The static site's forms (`quote` and `contact`) post to Express endpoints:
- `POST /forms/contact.php` → sends email with fields: `name, email, subject, message`.
- `POST /forms/quote.php` → sends email with fields: `name, email, phone, message`.

Responses return plain text `OK` on success to satisfy the legacy JS validator.

## Mail Configuration

Uses Nodemailer (`backend/utils/email.js`). Environment variables:

```
SMTP_HOST=your.smtp.host
SMTP_PORT=465
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM="Bin Masud <no-reply@yourdomain.com>"
CONTACT_MAIL_TO=dest@yourdomain.com
QUOTE_MAIL_TO=dest@yourdomain.com
```

If `CONTACT_MAIL_TO` or `QUOTE_MAIL_TO` are unset they fall back to `SMTP_USER`.

## Development

Run backend (ensure MySQL is up if API features needed):

```powershell
cd backend
npm install
npm run dev
```

Run React app in development (serves on port 3000):

```powershell
cd ../frontend
npm install
npm start
```

In development, visiting `http://localhost:3000` is convenient. The production build is what `/kuku` serves after running:

```powershell
cd frontend
npm run build
```

Then restart backend to pick up updated build artifacts.

## Future Improvements

- Multer 2.x in use; monitor security advisories.
- Add stronger rate limiting & captcha for form submissions.
- Create API endpoints for marketing site dynamic content.
- Unify navigation based on authentication state.

## Deployment Notes

Ensure build output exists (`frontend/build`) before deploying backend. All static legacy files are served directly; consider a CDN if traffic grows.
