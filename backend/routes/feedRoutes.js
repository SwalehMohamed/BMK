const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController'); // Ensure this path is correct
const { validateFeed } = require('../middleware/validation');
const authenticateToken = require('../middleware/authMiddleware');

// Define your routes
router.get('/', authenticateToken, feedController.getFeeds);
router.post('/', authenticateToken, validateFeed, feedController.addFeed);
router.put('/:id', authenticateToken, validateFeed, feedController.updateFeed);
router.delete('/:id', authenticateToken, feedController.deleteFeed);

// New route for feed usage
router.get('/usage', authenticateToken, feedController.getFeedUsage);
router.post('/usage', authenticateToken, feedController.recordFeedUsage);
router.put('/usage/:id', authenticateToken, feedController.updateFeedUsage);
router.delete('/usage/:id', authenticateToken, feedController.deleteFeedUsage);

module.exports = router;