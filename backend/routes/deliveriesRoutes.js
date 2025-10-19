const express = require('express');
const router = express.Router();
const deliveriesController = require('../controllers/deliveriesController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, deliveriesController.getAll);
router.post('/', authenticateToken, deliveriesController.create);
router.put('/:id', authenticateToken, deliveriesController.update);
router.delete('/:id', authenticateToken, deliveriesController.remove);

module.exports = router;
