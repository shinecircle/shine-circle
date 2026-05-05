const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// Trust proxy (required for Render / HTTPS)
app.set('trust proxy', 1);

// =========================
// DATABASE (POSTGRES ONLY)
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
  secret: 'shine-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false // set to true in production with HTTPS
  }
}));

// =========================
// DATABASE INIT (SAFE + ALL IN ONE)
// =========================
async function initDB() {
  try {
    console.log("Initializing database...");

    // CLIENTS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        username TEXT,
        firstname TEXT,
        lastname TEXT,
        role TEXT,
        password TEXT
      );
    `);

    // Redundant safety column (OK during debugging)
    await pool.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    // ACTIVITIES TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        clientid INTEGER,
        dayforcall TEXT,
        timeforcall TEXT,
        timezone TEXT
      );
    `);

    // Redundant safety column
    await pool.query(`
      ALTER TABLE activities
      ADD COLUMN IF NOT EXISTS clientid INTEGER;
    `);

    // Seed users if empty
    const result = await pool.query(`SELECT * FROM clients`);

    if (result.rows.length === 0) {
      console.log("Seeding default users...");

      await pool.query(`
        INSERT INTO clients (username, firstname, lastname, role, password)
        VALUES
        ('user','John','Doe','user','1234'),
        ('family','Sarah','Doe','caregiver','1234')
      `);
    }

    console.log("Database ready.");
  } catch (err) {
    console.error("DB INIT ERROR:", err);
  }
}

// Run DB init (non-blocking)
initDB();

// =========================
// DEBUG ROUTE
// =========================
app.get('/debug-users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role FROM clients ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

// =========================
// TEST ROUTE (NOW SAFE)
// =========================
app.get('/test', (req, res) => {
  res.send("TEST WORKING");
});

// =========================
// PAGE ROUTES
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/family', (req, res) => {
  res.sendFile(path.join(__dirname, 'family.html'));
});

// =========================
// LOGIN
// =========================
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM clients WHERE username=$1 AND password=$2`,
      [username, password]
    );

    const user = result.rows[0];

    if (!user) {
      return res.json({ success: false });
    }

    req.session.user = user;

    res.json({
      success: true,
      role: user.role
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
  }
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});