const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, salesController.getAll);

module.exports = router;
