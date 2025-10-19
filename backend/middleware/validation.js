const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

// Feed validation schema
const feedSchema = Joi.object({
  type: Joi.string().valid('starter', 'grower', 'finisher', 'layer').required(),
  quantity_kg: Joi.number().min(0).required(),
  supplier: Joi.string().min(3).max(100).required(),
  purchase_date: Joi.date().required(),
  expiry_date: Joi.date().min(Joi.ref('purchase_date')).required()
});

// Chick validation schema
const chickSchema = Joi.object({
  batch_name: Joi.string().required(),
  breed: Joi.string().required(),
  arrival_date: Joi.date().required(),
  supplier: Joi.string().required(),
  initial_count: Joi.number().integer().min(1).required()
});

const slaughteredSchema = Joi.object({
  batch_id: Joi.number().integer().required(),
  date: Joi.date().required(),
  quantity: Joi.number().integer().min(1).required(),
  avg_weight: Joi.number().min(0).optional(),
  notes: Joi.string().allow('').optional()
});

const mortalitySchema = Joi.object({
  date: Joi.date().required(),
  number_dead: Joi.number().integer().min(1).required(),
  reason: Joi.string().allow('').optional()
});

// Validate middleware
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return next(new ValidationError(errors));
  }

  req.body = value;
  next();
};

const validateFeed = validate(feedSchema);
const validateChick = validate(chickSchema);
const validateSlaughtered = validate(slaughteredSchema);
const validateMortality = validate(mortalitySchema);

module.exports = { 
  validate, 
  feedSchema, 
  chickSchema, 
  slaughteredSchema, 
  validateFeed, 
  validateChick, 
  validateSlaughtered,
  mortalitySchema,
  validateMortality
};