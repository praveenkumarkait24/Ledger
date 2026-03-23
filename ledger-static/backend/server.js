require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

// ─── Auth middleware ───────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Register ─────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Login ────────────────────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Get expenses ─────────────────────────────────────────────────
app.get('/api/expenses', apiLimiter, authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, amount, category, manual_category, description, date FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [req.user.id]
    );
    const expenses = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount),
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    }));
    res.json(expenses);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Add expense ──────────────────────────────────────────────────
app.post('/api/expenses', apiLimiter, authenticate, async (req, res) => {
  const { id, amount, category, manual_category, description, date } = req.body;
  if (!id || !amount || !category || !date) {
    return res.status(400).json({ error: 'id, amount, category, and date are required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO expenses (id, user_id, amount, category, manual_category, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, req.user.id, amount, category, manual_category || null, description || null, date]
    );
    const row = result.rows[0];
    res.status(201).json({
      ...row,
      amount: parseFloat(row.amount),
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Expense with this id already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Bulk seed expenses ───────────────────────────────────────────
app.post('/api/expenses/bulk', apiLimiter, authenticate, async (req, res) => {
  const { expenses } = req.body;
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: 'expenses must be a non-empty array' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of expenses) {
      await client.query(
        'INSERT INTO expenses (id, user_id, amount, category, manual_category, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [e.id, req.user.id, e.amount, e.category, e.manual_category || null, e.description || null, e.date]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── Delete expense ───────────────────────────────────────────────
app.delete('/api/expenses/:id', apiLimiter, authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Ledger backend running on port ${PORT}`));
