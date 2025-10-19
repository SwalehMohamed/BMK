const express = require('express');
const router = express.Router();
const controller = require('../controllers/productTypesController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, controller.getAll);
router.post('/', authenticateToken, controller.create);
router.put('/:id', authenticateToken, controller.update);
router.delete('/:id', authenticateToken, controller.remove);

module.exports = router;
