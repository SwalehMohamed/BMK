const express = require('express');
const router = express.Router();
const chickController = require('../controllers/chickController');
const { validateChick, validateMortality } = require('../middleware/validation');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, chickController.getAllChicks);
router.post('/', authenticateToken, validateChick, chickController.addChick);
router.put('/:id', authenticateToken, validateChick, chickController.updateChick);
router.delete('/:id', authenticateToken, chickController.deleteChick);

// Mortality endpoints
router.get('/:id/mortalities', authenticateToken, chickController.getMortalities);
router.post('/:id/mortalities', authenticateToken, validateMortality, chickController.recordMortality);

// Feed history for a batch
router.get('/:id/feed-usage', authenticateToken, chickController.getBatchFeedUsage);

module.exports = router;
