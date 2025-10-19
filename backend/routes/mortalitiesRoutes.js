const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mortalitiesController');
const authenticateToken = require('../middleware/authMiddleware');
const { validateMortality } = require('../middleware/validation');

// All endpoints require auth
router.get('/', authenticateToken, ctrl.getAll);
router.post('/', authenticateToken, validateMortality, ctrl.create);
router.delete('/:id', authenticateToken, ctrl.remove);

module.exports = router;
