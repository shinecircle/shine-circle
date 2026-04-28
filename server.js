const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

const app = express();
const db = new sqlite3.Database('./data.db');

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(
  session({
    secret: 'shinecare-secret',
    resave: false,
    saveUninitialized: false
  })
);

// =========================
// ✅ ROOT ROUTE (FIXES RENDER ERROR)
// =========================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/howitworks.html');
});

// =========================
// DATABASE SETUP
// =========================
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      parentId INTEGER,
      firstName TEXT,
      lastName TEXT,
      nickname TEXT,
      phone TEXT,
      email TEXT,
      dayForCall TEXT,
      timeForCall TEXT,
      timezone TEXT
    )
  `);

  db.run(`ALTER TABLE users ADD COLUMN dayForCall TEXT`, ()=>{});
  db.run(`ALTER TABLE users ADD COLUMN timeForCall TEXT`, ()=>{});
  db.run(`ALTER TABLE users ADD COLUMN timezone TEXT`, ()=>{});

  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      mood TEXT,
      meds TEXT,
      timestamp TEXT
    )
  `);

  // DEFAULT USER
  db.run(`
    INSERT OR IGNORE INTO users
    (id, username, password, role, parentId, firstName, lastName, nickname)
    VALUES (1,'user','1234','user',NULL,'John','Smith','Johnny')
  `);

  // FAMILY USER
  db.run(`
    INSERT OR IGNORE INTO users
    (username,password,role,parentId,firstName,lastName)
    VALUES ('family','1234','family',1,'Sarah','Smith')
  `);
});

// =========================
// LOGIN
// =========================
app.post('/login', (req, res) => {

  const { username, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE username=? AND password=?`,
    [username, password],
    (err, user) => {

      if (!user) return res.json({ success: false });

      req.session.user = user;

      res.json({
        success: true,
        role: user.role
      });
    }
  );
});

// =========================
// AUTH / LOGOUT
// =========================
app.get('/auth', (req, res) => {
  res.json(req.session.user || null);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// =========================
// CHECK-IN SAVE
// =========================
app.post('/checkin', (req, res) => {

  const user = req.session.user;

  if (!user || user.role !== 'user') {
    return res.json({ success: false });
  }

  const { mood, meds } = req.body;

  db.run(
    `INSERT INTO checkins (userId, mood, meds, timestamp)
     VALUES (?, ?, ?, ?)`,
    [user.id, mood, meds, new Date().toISOString()]
  );

  res.json({ success: true });
});

// =========================
// CHECK IF ALREADY CHECKED IN TODAY
// =========================
app.get('/checkin-today', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({ checkedIn: false });

  db.get(
    `SELECT * FROM checkins
     WHERE userId=?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [user.id],
    (err, row) => {

      if (!row) return res.json({ checkedIn: false });

      const today = new Date().toDateString();
      const rowDate = new Date(row.timestamp).toDateString();

      res.json({
        checkedIn: today === rowDate,
        mood: row.mood,
        meds: row.meds,
        timestamp: row.timestamp
      });
    }
  );
});

// =========================
// ACTIVITIES
// =========================
app.get('/activities', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({});

  db.get(
    `SELECT dayForCall, timeForCall, timezone FROM users WHERE id=?`,
    [user.id],
    (err, row) => res.json(row || {})
  );
});

app.post('/activities', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({ success: false });

  const { dayForCall, timeForCall, timezone } = req.body;

  db.run(
    `UPDATE users
     SET dayForCall=?, timeForCall=?, timezone=?
     WHERE id=?`,
    [dayForCall, timeForCall, timezone, user.id]
  );

  res.json({ success: true });
});

// =========================
// FAMILY DASHBOARD
// =========================
app.get('/family-data', (req, res) => {

  const u = req.session.user;

  if (!u || u.role !== 'family') {
    return res.json({ checkins: [], user: null });
  }

  const targetUserId = u.parentId || 1;

  db.get(
    `SELECT firstName, nickname, dayForCall, timeForCall, timezone
     FROM users WHERE id=?`,
    [targetUserId],
    (err, userInfo) => {

      db.all(
        `SELECT * FROM checkins
         WHERE userId=?
         ORDER BY timestamp DESC`,
        [targetUserId],
        (err2, rows) => {

          res.json({
            checkins: rows || [],
            user: userInfo || null
          });
        }
      );
    }
  );
});

// =========================
// START SERVER (RENDER READY)
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
