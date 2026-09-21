const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const Entry = require('../models/Entry');
const auth = require('../middleware/auth');
const { analyzeSentiment } = require('../utils/sentiment');

const router = express.Router();

router.use(auth); // every route below requires a logged-in user

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_IMAGES_PER_ENTRY = 8;

// --------------------------------------------------
// Cloudinary configuration
// --------------------------------------------------

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --------------------------------------------------
// Multer configuration
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    // Maximum image size: 5 MB
    fileSize: 5 * 1024 * 1024,

    // Maximum number of files in one request
    files: MAX_IMAGES_PER_ENTRY
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// --------------------------------------------------
// Helper: upload a buffer to Cloudinary
// --------------------------------------------------

function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// --------------------------------------------------
// Helper: safely delete a Cloudinary image
// --------------------------------------------------

async function deleteFromCloudinary(publicId) {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn(
      'Could not delete Cloudinary image:',
      error.message
    );
  }
}

// --------------------------------------------------
// GET /api/entries/summary?year=2026&month=9
// --------------------------------------------------

router.get('/summary', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({
        message: 'Valid year and month (1-12) are required'
      });
    }

    const mm = String(month).padStart(2, '0');
    const prefix = `${year}-${mm}-`;

    const entries = await Entry.find({
      user: req.userId,
      date: { $regex: `^${prefix}` }
    })
      .select('date mood title images -_id')
      .sort({ date: 1 });

    res.json({ entries });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// GET /api/entries/search
// --------------------------------------------------

router.get('/search', async (req, res) => {
  try {
    const { q, tag, mood, from, to } = req.query;

    const filter = {
      user: req.userId
    };

    if (q) {
      filter.$text = {
        $search: q
      };
    }

    if (tag) {
      filter.tags = tag;
    }

    if (mood) {
      filter.mood = mood;
    }

    if (from || to) {
      filter.date = {};

      if (from) {
        filter.date.$gte = from;
      }

      if (to) {
        filter.date.$lte = to;
      }
    }

    const entries = await Entry.find(filter)
      .sort({ date: -1 })
      .limit(200);

    res.json({ entries });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// GET /api/entries/streak
// --------------------------------------------------

router.get('/streak', async (req, res) => {
  try {
    const entries = await Entry.find({
      user: req.userId
    })
      .select('date -_id')
      .sort({ date: 1 });

    const dates = entries.map((e) => e.date);

    if (dates.length === 0) {
      return res.json({
        currentStreak: 0,
        longestStreak: 0
      });
    }

    const dateSet = new Set(dates);

    let longestStreak = 1;
    let run = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);

      const dayDiff = Math.round(
        (curr - prev) / (1000 * 60 * 60 * 24)
      );

      run = dayDiff === 1 ? run + 1 : 1;

      longestStreak = Math.max(longestStreak, run);
    }

    let currentStreak = 0;

    const cursor = new Date();

    const toKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;

    if (!dateSet.has(toKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (dateSet.has(toKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    res.json({
      currentStreak,
      longestStreak
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// GET /api/entries/analytics
// --------------------------------------------------

router.get('/analytics', async (req, res) => {
  try {
    const { from, to } = req.query;

    const filter = {
      user: req.userId
    };

    if (from || to) {
      filter.date = {};

      if (from) {
        filter.date.$gte = from;
      }

      if (to) {
        filter.date.$lte = to;
      }
    }

    const entries = await Entry.find(filter)
      .select(
        'date mood sentimentScore sentimentLabel -_id'
      )
      .sort({ date: 1 });

    const moodCounts = {
      great: 0,
      good: 0,
      okay: 0,
      bad: 0,
      terrible: 0
    };

    entries.forEach((e) => {
      if (e.mood) {
        moodCounts[e.mood] += 1;
      }
    });

    const sentimentTrend = entries
      .filter((e) => e.sentimentScore !== null)
      .map((e) => ({
        date: e.date,
        score: e.sentimentScore,
        label: e.sentimentLabel
      }));

    res.json({
      moodCounts,
      sentimentTrend,
      totalEntries: entries.length
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// POST /api/entries/:date/images
//
// Upload multiple images for an entry.
// Field name: "images"
// Maximum: 8 images per entry
// --------------------------------------------------

router.post(
  '/:date/images',
  upload.array('images', MAX_IMAGES_PER_ENTRY),
  async (req, res) => {
    const { date } = req.params;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: 'Please select at least one image to upload'
      });
    }

    let uploadedImages = [];

    try {
      let entry = await Entry.findOne({
        user: req.userId,
        date
      });

      if (!entry) {
        entry = new Entry({
          user: req.userId,
          date,
          images: []
        });
      }

      const currentImageCount = entry.images
        ? entry.images.length
        : 0;

      if (
        currentImageCount + req.files.length >
        MAX_IMAGES_PER_ENTRY
      ) {
        return res.status(400).json({
          message: `An entry can contain a maximum of ${MAX_IMAGES_PER_ENTRY} images.`
        });
      }

      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file.buffer,
          {
            folder: 'daily-journal',
            resource_type: 'image'
          }
        );

        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id,
          caption: '',
          width: result.width || null,
          height: result.height || null
        });
      }

      entry.images.push(...uploadedImages);

      await entry.save();

      res.json({
        message: 'Images uploaded successfully',
        images: uploadedImages,
        entry
      });
    } catch (err) {
      console.error('Multiple image upload error:', err);

      for (const image of uploadedImages) {
        await deleteFromCloudinary(image.publicId);
      }

      res.status(500).json({
        message: 'Image upload failed',
        error: err.message
      });
    }
  }
);

// --------------------------------------------------
// POST /api/entries/:date/image
//
// Compatibility route for the old frontend.
//
// Adds the uploaded image to the entry's image gallery.
// --------------------------------------------------

router.post(
  '/:date/image',
  upload.single('image'),
  async (req, res) => {
    const { date } = req.params;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Please select an image to upload'
      });
    }

    let uploadedImage = null;

    try {
      let entry = await Entry.findOne({
        user: req.userId,
        date
      });

      if (!entry) {
        entry = new Entry({
          user: req.userId,
          date,
          images: []
        });
      }

      const currentImageCount = entry.images
        ? entry.images.length
        : 0;

      if (currentImageCount >= MAX_IMAGES_PER_ENTRY) {
        return res.status(400).json({
          message: `An entry can contain a maximum of ${MAX_IMAGES_PER_ENTRY} images.`
        });
      }

      const result = await uploadToCloudinary(
        req.file.buffer,
        {
          folder: 'daily-journal',
          resource_type: 'image'
        }
      );

      uploadedImage = {
        url: result.secure_url,
        publicId: result.public_id,
        caption: '',
        width: result.width || null,
        height: result.height || null
      };

      entry.images.push(uploadedImage);

      await entry.save();

      res.json({
        message: 'Image uploaded successfully',

        imageUrl: uploadedImage.url,
        imagePublicId: uploadedImage.publicId,

        image: uploadedImage,
        entry
      });
    } catch (err) {
      console.error('Image upload error:', err);

      if (uploadedImage) {
        await deleteFromCloudinary(
          uploadedImage.publicId
        );
      }

      res.status(500).json({
        message: 'Image upload failed',
        error: err.message
      });
    }
  }
);

// --------------------------------------------------
// DELETE /api/entries/:date/images/:imageId
//
// Delete one specific image from an entry.
// --------------------------------------------------

router.delete(
  '/:date/images/:imageId',
  async (req, res) => {
    const { date, imageId } = req.params;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    try {
      const entry = await Entry.findOne({
        user: req.userId,
        date
      });

      if (!entry) {
        return res.status(404).json({
          message: 'No entry for this date'
        });
      }

      const image = entry.images.id(imageId);

      if (!image) {
        return res.status(404).json({
          message: 'Image not found'
        });
      }

      const publicId = image.publicId;

      image.deleteOne();

      await entry.save();

      await deleteFromCloudinary(publicId);

      res.json({
        message: 'Image removed successfully',
        entry
      });
    } catch (err) {
      console.error('Image deletion error:', err);

      res.status(500).json({
        message: 'Could not remove image',
        error: err.message
      });
    }
  }
);

// --------------------------------------------------
// DELETE /api/entries/:date/image
//
// Compatibility route for the old frontend.
//
// Deletes the most recently added image.
// --------------------------------------------------

router.delete('/:date/image', async (req, res) => {
  const { date } = req.params;

  if (!DATE_RE.test(date)) {
    return res.status(400).json({
      message: 'Date must be in YYYY-MM-DD format'
    });
  }

  try {
    const entry = await Entry.findOne({
      user: req.userId,
      date
    });

    if (!entry) {
      return res.status(404).json({
        message: 'No entry for this date'
      });
    }

    if (!entry.images || entry.images.length === 0) {
      return res.status(404).json({
        message: 'No images attached to this entry'
      });
    }

    const image =
      entry.images[entry.images.length - 1];

    const publicId = image.publicId;

    image.deleteOne();

    await entry.save();

    await deleteFromCloudinary(publicId);

    res.json({
      message: 'Image removed successfully',
      entry
    });
  } catch (err) {
    console.error('Image deletion error:', err);

    res.status(500).json({
      message: 'Could not remove image',
      error: err.message
    });
  }
});

// --------------------------------------------------
// PUT /api/entries/:date/images/:imageId
//
// Update the caption of one image.
// --------------------------------------------------

router.put(
  '/:date/images/:imageId',
  async (req, res) => {
    const { date, imageId } = req.params;
    const { caption } = req.body;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    if (typeof caption !== 'string') {
      return res.status(400).json({
        message: 'Caption must be a string'
      });
    }

    if (caption.trim().length > 300) {
      return res.status(400).json({
        message: 'Caption cannot exceed 300 characters'
      });
    }

    try {
      const entry = await Entry.findOne({
        user: req.userId,
        date
      });

      if (!entry) {
        return res.status(404).json({
          message: 'No entry for this date'
        });
      }

      const image = entry.images.id(imageId);

      if (!image) {
        return res.status(404).json({
          message: 'Image not found'
        });
      }

      image.caption = caption.trim();

      await entry.save();

      res.json({
        message: 'Caption updated successfully',
        image
      });
    } catch (err) {
      console.error('Caption update error:', err);

      res.status(500).json({
        message: 'Could not update image caption',
        error: err.message
      });
    }
  }
);

// --------------------------------------------------
// GET /api/entries/:date
// --------------------------------------------------

router.get('/:date', async (req, res) => {
  const { date } = req.params;

  if (!DATE_RE.test(date)) {
    return res.status(400).json({
      message: 'Date must be in YYYY-MM-DD format'
    });
  }

  try {
    const entry = await Entry.findOne({
      user: req.userId,
      date
    });

    if (!entry) {
      return res.status(404).json({
        message: 'No entry for this date'
      });
    }

    res.json({ entry });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// PUT /api/entries/:date
//
// Create/update the entry.
// Images are intentionally not modified here.
// --------------------------------------------------

router.put(
  '/:date',
  [
    body('title').optional().isString(),

    body('body').optional().isString(),

    body('mood')
      .optional()
      .isIn([
        'great',
        'good',
        'okay',
        'bad',
        'terrible',
        null
      ]),

    body('tags').optional().isArray()
  ],
  async (req, res) => {
    const { date } = req.params;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    try {
      const {
        title,
        body: entryBody,
        mood,
        tags
      } = req.body;

      const sentimentFields = {};

      if (entryBody !== undefined) {
        const { score, label } =
          analyzeSentiment(entryBody);

        sentimentFields.sentimentScore = score;
        sentimentFields.sentimentLabel = label;
      }

      const entry = await Entry.findOneAndUpdate(
        {
          user: req.userId,
          date
        },
        {
          $set: {
            ...(title !== undefined && { title }),

            ...(entryBody !== undefined && {
              body: entryBody
            }),

            ...(mood !== undefined && { mood }),

            ...(tags !== undefined && { tags }),

            ...sentimentFields
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

      res.json({ entry });
    } catch (err) {
      res.status(500).json({
        message: 'Server error',
        error: err.message
      });
    }
  }
);

// --------------------------------------------------
// DELETE /api/entries/:date
// --------------------------------------------------

router.delete('/:date', async (req, res) => {
  const { date } = req.params;

  if (!DATE_RE.test(date)) {
    return res.status(400).json({
      message: 'Date must be in YYYY-MM-DD format'
    });
  }

  try {
    const result = await Entry.findOneAndDelete({
      user: req.userId,
      date
    });

    if (!result) {
      return res.status(404).json({
        message: 'No entry for this date'
      });
    }

    // ------------------------------------------------
    // Clean up ALL Cloudinary images belonging
    // to this journal entry.
    // ------------------------------------------------

    if (result.images && result.images.length > 0) {
      for (const image of result.images) {
        await deleteFromCloudinary(image.publicId);
      }
    }

    res.json({
      message: 'Entry deleted'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

// --------------------------------------------------
// Multer error handler
// --------------------------------------------------

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message:
          'Image is too large. Maximum size is 5 MB.'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message:
          `You can upload a maximum of ${MAX_IMAGES_PER_ENTRY} images at once.`
      });
    }

    return res.status(400).json({
      message: err.message
    });
  }

  if (
    err &&
    err.message === 'Only image files are allowed'
  ) {
    return res.status(400).json({
      message: err.message
    });
  }

  next(err);
});

module.exports = router;