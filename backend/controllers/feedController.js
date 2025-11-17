const FeedModel = require('../models/feedModel');
const { AppError, NotFoundError, ValidationError } = require('../utils/errors');

class FeedController {
  async getFeeds(req, res, next) {
    try {
      const feeds = await FeedModel.findAll();
      // Augment with usage totals if available via aggregate helper
      try {
        const totals = await FeedModel.getUsageTotalsAll();
        const totalsMap = new Map(totals.map(t => [String(t.feed_id), Number(t.total_used || 0)]));
        feeds.forEach(f => {
          const used = totalsMap.get(String(f.id)) || 0;
          f.used_total = used;
        });
      } catch (e) {
        // ignore if table/columns not available
      }
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
      const feedId = req.params.id;
      // Guard: do not delete if usage events exist
      try {
        const count = await FeedModel.countUsageForFeed(feedId);
        if (count > 0) {
          return next(new ValidationError([{ field: 'feed', message: 'Cannot delete feed with usage records.' }]));
        }
      } catch (e) {
        // if count check fails, proceed with delete
      }
      await FeedModel.delete(feedId);
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
          const page = Math.max(1, parseInt(req.query.page, 10) || 1);
          const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
          const offset = (page - 1) * limit;
          const q = req.query.q || '';
          const start_date = req.query.start_date || null;
          const end_date = req.query.end_date || null;

          const [usageEvents, total] = await Promise.all([
            FeedModel.getUsageEventsPaged({ feed_id, offset, limit, q, start_date, end_date }),
            FeedModel.countUsageEvents({ feed_id, q, start_date, end_date })
          ]);

          res.json({
            usage: usageEvents,
            meta: { page, limit, total, pages: Math.ceil(total / limit) }
          });
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
            return next(new ValidationError([{ field: 'quantity_used', message: 'feed_id and valid quantity_used are required.' }]));
          }
          // Validate availability before recording usage
          const feed = await FeedModel.findById(feed_id);
          if (!feed) {
            return next(new NotFoundError('Feed'));
          }
          const requested = Number(quantity_used);
          const available = Number(feed.quantity_kg);
          if (requested > available) {
            return next(new ValidationError([
              { field: 'quantity_used', message: `Quantity used exceeds available stock (${available} kg).` }
            ]));
          }
          // Subtract the used amount from the feed quantity
          const updatedFeed = await FeedModel.recordUsage(feed_id, requested);
          // Log the usage event
          await FeedModel.logUsageEvent({ feed_id, user_id, batch_id, quantity_used: requested, date_used });
          res.status(201).json({ message: 'Feed usage recorded.', feed: updatedFeed });
        } catch (err) {
          next(err);
        }
      }

      async updateFeedUsage(req, res, next) {
        try {
          const id = req.params.id;
          const { quantity_used } = req.body;
          if (!id || !quantity_used || isNaN(quantity_used) || Number(quantity_used) <= 0) {
            return next(new ValidationError([{ field: 'quantity_used', message: 'Valid quantity_used is required.' }]));
          }
          const updatedEvent = await FeedModel.updateUsageEventQuantity(id, Number(quantity_used));
          if (!updatedEvent) return next(new NotFoundError('Usage event'));
          res.json({ message: 'Usage event updated', event: updatedEvent });
        } catch (err) {
          next(err);
        }
      }

      async deleteFeedUsage(req, res, next) {
        try {
          const id = req.params.id;
          const ok = await FeedModel.deleteUsageEvent(id);
          if (!ok) return next(new NotFoundError('Usage event'));
          res.json({ message: 'Usage event deleted' });
        } catch (err) {
          next(err);
        }
      }
}

// Export an instance of the controller
module.exports = new FeedController();