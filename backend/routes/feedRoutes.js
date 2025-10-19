const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController'); // Ensure this path is correct
const { validateFeed } = require('../middleware/validation');
const authenticateToken = require('../middleware/authMiddleware');

// Define your routes
router.get('/', authenticateToken, feedController.getFeeds); // Ensure getFeeds is a function
router.post('/', authenticateToken, validateFeed, feedController.addFeed); // Ensure addFeed is a function
router.put('/:id', authenticateToken, validateFeed, feedController.updateFeed); // Ensure updateFeed is a function
router.delete('/:id', authenticateToken, feedController.deleteFeed); // Ensure deleteFeed is a function

// New route for feed usage
router.get('/usage', authenticateToken, feedController.getFeedUsage);
// New POST route for recording feed usage
router.post('/usage', authenticateToken, feedController.recordFeedUsage);

module.exports = router;