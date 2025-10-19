const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware');

// Public routes
router.post('/login', userController.login);
router.post('/register', userController.createUser);

// Protected routes
router.get('/', authenticateToken, userController.getAllUsers);
router.get('/me', authenticateToken, userController.getCurrentUser);

module.exports = router;
