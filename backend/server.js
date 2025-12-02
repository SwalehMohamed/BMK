const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const upload = multer();
const rateLimit = require('express-rate-limit');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { sendMail } = require('./utils/email');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const feedRoutes = require('./routes/feedRoutes'); 
const chickRoutes = require('./routes/chickRoutes'); 
const slaughteredRoutes = require('./routes/slaughteredRoutes'); 
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middleware/errorHandler'); 
const reportsRoutes = require('./routes/reportsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productsRoutes = require('./routes/productsRoutes');
const productTypesRoutes = require('./routes/productTypesRoutes');
const ordersRoutes = require('./routes/ordersRoutes');
const deliveriesRoutes = require('./routes/deliveriesRoutes');
const salesRoutes = require('./routes/salesRoutes');
const mortalitiesRoutes = require('./routes/mortalitiesRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const { ensureTables } = require('./config/dbInit');
const { verifyTransport } = require('./utils/email');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`, req.body);
  next();
});

// Serve legacy site as landing page at '/'
const repoRoot = path.join(__dirname, '..');
const legacyCandidate = path.join(repoRoot, 'legacy-bmtc');
const legacyRoot = fs.existsSync(legacyCandidate) ? legacyCandidate : repoRoot;
// Root-level static for legacy assets and forms
app.use('/assets', express.static(path.join(legacyRoot, 'assets')));
app.use('/forms', express.static(path.join(legacyRoot, 'forms')));
app.get('/', (req, res) => {
  res.sendFile(path.join(legacyRoot, 'index.html'));
});

// Serve legacy company website (static) under /company
app.use('/company/assets', express.static(path.join(legacyRoot, 'assets')));
app.use('/company/forms', express.static(path.join(legacyRoot, 'forms')));
// Serve top-level legacy html pages
app.get(['/company', '/company/',
  '/company/index.html',
  '/company/about.html',
  '/company/services.html',
  '/company/Constructions.html',
  '/company/contact.html'], (req, res) => {
  const file = req.path.replace('/company', '') || '/index.html';
  const target = path.join(legacyRoot, file);
  res.sendFile(target);
});

// Serve root-level legacy pages directly (e.g., /services.html)
const topLevelLegacyPages = [
  'index.html',
  'about.html',
  'services.html',
  'Constructions.html',
  'contact.html'
];
app.get(topLevelLegacyPages.map(p => `/${p}`), (req, res) => {
  const file = req.path.slice(1);
  res.sendFile(path.join(legacyRoot, file));
});

// Map legacy Future pages to root and /company for convenience
const legacyFuturePages = ['projects.html', 'project-details.html', 'service-details.html', 'sample-inner-page.html'];
app.get(legacyFuturePages.map(p => `/${p}`), (req, res) => {
  const file = req.path.slice(1);
  res.sendFile(path.join(legacyRoot, 'assets', 'Future', file));
});
app.get(legacyFuturePages.map(p => `/company/${p}`), (req, res) => {
  const file = req.path.replace('/company/', '');
  res.sendFile(path.join(legacyRoot, 'assets', 'Future', file));
});

// Serve React build under /app (SPA)
const appBuildRoot = path.join(__dirname, '..', 'frontend', 'build');
app.use('/app', express.static(appBuildRoot));
app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(appBuildRoot, 'index.html'));
});

// Also serve React build under /kuku (matches build asset paths)
app.use('/kuku', express.static(appBuildRoot));
app.get(['/kuku', '/kuku/*'], (req, res) => {
  res.sendFile(path.join(appBuildRoot, 'index.html'));
});

// Expose build root assets at server root for components using absolute paths
app.use(express.static(appBuildRoot));

// ----- Legacy forms -> Express mailer endpoints -----
// Rate limiting for form submissions
const formLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

async function verifyRecaptcha(token) {
  try {
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret || !token) return true; // if not configured, allow
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token })
    });
    const data = await resp.json();
    return !!data.success;
  } catch {
    return false;
  }
}
// contact.php expects: name, email, subject, message; respond 'OK' on success
app.post('/forms/contact.php', formLimiter, upload.none(), async (req, res) => {
  try {
    const { name = '', email = '', subject = '', message = '', ['recaptcha-response']: recaptcha } = req.body || {};
    if (!(await verifyRecaptcha(recaptcha))) {
      return res.status(400).type('text/plain').send('Captcha failed');
    }
    const to = process.env.CONTACT_MAIL_TO || process.env.SMTP_USER || 'kuku@binmasud.co.ke';
    const html = `
      <h2>Website Contact Form</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    `;
    await sendMail({ to, subject: `[Website Contact] ${subject || 'New message'}`, html });
    res.type('text/plain').send('OK');
  } catch (err) {
    res.status(500).type('text/plain').send('Sending failed');
  }
});

// quote.php expects: name, email, phone, message; respond 'OK' on success
app.post('/forms/quote.php', formLimiter, upload.none(), async (req, res) => {
  try {
    const { name = '', email = '', phone = '', message = '', ['recaptcha-response']: recaptcha } = req.body || {};
    if (!(await verifyRecaptcha(recaptcha))) {
      return res.status(400).type('text/plain').send('Captcha failed');
    }
    const to = process.env.QUOTE_MAIL_TO || process.env.SMTP_USER || 'kuku@binmasud.co.ke';
    const html = `
      <h2>Website Quote Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    `;
    await sendMail({ to, subject: 'New Quote Request', html });
    res.type('text/plain').send('OK');
  } catch (err) {
    res.status(500).type('text/plain').send('Sending failed');
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Routes
app.use('/api/auth', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/chicks', chickRoutes);
app.use('/api/slaughtered', slaughteredRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/product-types', productTypesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/mortalities', mortalitiesRoutes);
app.use('/api/marketing', marketingRoutes);

// Error handling middleware
app.use(errorHandler);

// Ensure required tables exist before starting the server
ensureTables()
  .catch(err => console.error('DB initialization failed:', err))
  .finally(() => {
    // Verify SMTP connection (non-blocking)
    verifyTransport?.();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Legacy root serving from: ${legacyRoot}`);
      console.log(`Legacy site available at http://localhost:${PORT}/ (and /company)`);
      console.log(`Web app (React build) at http://localhost:${PORT}/kuku (and /app)`);
      if (process.env.RECAPTCHA_SECRET) {
        console.log('reCAPTCHA verification enabled for form endpoints');
      }
    });
  });
