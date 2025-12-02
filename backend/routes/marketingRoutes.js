const express = require('express');
const router = express.Router();

// Example: Simple read-only endpoints for marketing content
// In future, back these by a DB or CMS.

router.get('/site-info', (req, res) => {
  res.json({
    name: 'Bin Masud Trading Company Limited',
    tagline: 'Integrated Supplies & Engineering',
    address: 'Abdulnasser Road, Bondeni, Mombasa',
    phone: ['+254706073334', '+254720583918'],
    email: ['binmasudtc@gmail.com', 'omar.swaleh@gmail.com']
  });
});

router.get('/projects', (req, res) => {
  res.json([
    { id: 1, title: 'Building Works', slug: 'building-works' },
    { id: 2, title: 'Road & Water Infrastructure', slug: 'road-water' },
    { id: 3, title: 'Construction Management', slug: 'construction-mgmt' }
  ]);
});

module.exports = router;
