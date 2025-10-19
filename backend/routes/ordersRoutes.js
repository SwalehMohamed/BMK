const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, ordersController.getAll);
router.post('/', authenticateToken, ordersController.create);
router.put('/:id', authenticateToken, ordersController.update);
router.delete('/:id', authenticateToken, ordersController.remove);

module.exports = router;
