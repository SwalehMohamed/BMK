const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, productsController.getAll);
router.post('/', authenticateToken, productsController.create);
router.put('/:id', authenticateToken, productsController.update);
router.delete('/:id', authenticateToken, productsController.remove);

module.exports = router;