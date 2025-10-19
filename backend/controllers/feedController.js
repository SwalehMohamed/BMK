const FeedModel = require('../models/feedModel');
const { AppError, NotFoundError, ValidationError } = require('../utils/errors');

class FeedController {
  async getFeeds(req, res, next) {
    try {
      const feeds = await FeedModel.findAll(); // Ensure this method exists in your model
      res.json(feeds);
    } catch (err) {
      next(err);
    }
  }

  async addFeed(req, res, next) {
    try {
      const newFeed = await FeedModel.create(req.body); // Ensure this method exists in your model
      res.status(201).json(newFeed);
    } catch (err) {
      next(err);
    }
  }

  async updateFeed(req, res, next) {
    try {
      const updatedFeed = await FeedModel.update(req.params.id, req.body); // Ensure this method exists in your model
      res.json(updatedFeed);
    } catch (err) {
      next(err);
    }
  }

  async deleteFeed(req, res, next) {
    try {
      await FeedModel.delete(req.params.id); // Ensure this method exists in your model
      res.json({ message: 'Feed deleted successfully' }); // Changed from res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

    // New method for feed usage
    async getFeedUsage(req, res, next) {
      try {
        const feed_id = req.query.feed_id;
        if (!feed_id) {
          return res.status(400).json({ message: 'feed_id is required as query param.' });
        }
        const usageEvents = await FeedModel.getUsageEvents(feed_id);
        res.json({ usage: usageEvents });
      } catch (err) {
        next(err);
      }
    }

      // New method for recording feed usage
      async recordFeedUsage(req, res, next) {
        try {
          const { feed_id, batch_id, quantity_used, date_used } = req.body;
          const user_id = req.userId;
          if (!feed_id || !quantity_used || isNaN(quantity_used) || Number(quantity_used) <= 0) {
            return res.status(400).json({ message: 'feed_id and valid quantity_used are required.' });
          }
          // Subtract the used amount from the feed quantity
          const updatedFeed = await FeedModel.recordUsage(feed_id, Number(quantity_used));
          // Log the usage event
          await FeedModel.logUsageEvent({ feed_id, user_id, batch_id, quantity_used: Number(quantity_used), date_used });
          res.status(201).json({ message: 'Feed usage recorded.', feed: updatedFeed });
        } catch (err) {
          next(err);
        }
      }
}

// Export an instance of the controller
module.exports = new FeedController();