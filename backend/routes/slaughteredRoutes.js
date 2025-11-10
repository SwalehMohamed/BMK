
const express = require('express');
const router = express.Router();
const slaughteredController = require('../controllers/slaughteredController');
const authenticateToken = require('../middleware/authMiddleware');
const { validateSlaughtered } = require('../middleware/validation');
// Batch product creation from slaughtered record
router.post('/create-products', authenticateToken, slaughteredController.createProductsFromSlaughter);

router.get('/', authenticateToken, slaughteredController.getAllSlaughtered);
router.post('/', authenticateToken, validateSlaughtered, slaughteredController.addSlaughtered);
router.put('/:id', authenticateToken, validateSlaughtered, slaughteredController.updateSlaughtered);
router.delete('/:id', authenticateToken, slaughteredController.deleteSlaughtered);

module.exports = router;