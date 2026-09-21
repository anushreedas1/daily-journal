const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true
    },

    publicId: {
      type: String,
      required: true
    },

    caption: {
      type: String,
      trim: true,
      default: ''
    },

    width: {
      type: Number,
      default: null
    },

    height: {
      type: Number,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const entrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Stored as 'YYYY-MM-DD' so each calendar day
    // maps to at most one entry per user.
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },

    title: {
      type: String,
      trim: true,
      default: ''
    },

    body: {
      type: String,
      default: ''
    },

    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'bad', 'terrible', null],
      default: null
    },

    tags: {
      type: [String],
      default: []
    },

    // Multiple photos can now belong to one journal entry.
    images: {
      type: [imageSchema],
      default: []
    },

    // Computed automatically on save/update from the entry body.
    sentimentScore: {
      type: Number,
      default: null
    },

    sentimentLabel: {
      type: String,
      enum: ['positive', 'neutral', 'negative', null],
      default: null
    }
  },
  { timestamps: true }
);

// One entry per user per day
entrySchema.index({ user: 1, date: 1 }, { unique: true });

// Text index for full-text search across title/body/tags
entrySchema.index({
  title: 'text',
  body: 'text',
  tags: 'text'
});

module.exports = mongoose.model('Entry', entrySchema);