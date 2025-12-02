const express = require('express');
const path = require('path');
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
const legacyRoot = path.join(__dirname, '..', 'legacy-bmtc');
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

// Serve React build under /app (SPA)
const appBuildRoot = path.join(__dirname, '..', 'frontend', 'build');
app.use('/app', express.static(appBuildRoot));
app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(appBuildRoot, 'index.html'));
});

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
      console.log(`Legacy site available at http://localhost:${PORT}/ (and /company)`);
      console.log(`Web app (React build) at http://localhost:${PORT}/app`);
    });
  });
