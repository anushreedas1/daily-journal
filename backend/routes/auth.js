const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username')
      .trim()
      .isLength({ min: 3, max: 24 }).withMessage('Username must be 3 to 24 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only use letters, numbers, and underscores')
      .toLowerCase(),
    body('email').trim().isEmail().withMessage('Valid email is required').toLowerCase(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, username, email, password } = req.body;

      const existing = await User.findOne({ $or: [{ email }, { username }] });
      if (existing) {
        const message = existing.email === email ? 'Email already in use' : 'Username already in use';
        return res.status(409).json({ message });
      }

      const user = await User.create({ name, username, email, password });
      const token = signToken(user._id);

      res.status(201).json({ token, user });
    } catch (err) {
      console.error('[auth/register] Failed:', err.name, err.code, err.message);
      if (err.code === 11000) {
        const duplicateField = Object.keys(err.keyPattern || {})[0];
        const message = duplicateField === 'username' ? 'Username already in use' : 'Email already in use';
        return res.status(409).json({ message });
      }
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('identifier')
      .custom((value, { req }) => Boolean(value || req.body.email))
      .withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const identifier = String(req.body.identifier || req.body.email).trim().toLowerCase();
      const { password } = req.body;

      const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const match = await user.comparePassword(password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = signToken(user._id);
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
