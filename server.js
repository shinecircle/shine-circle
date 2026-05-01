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
// ROOT ROUTE
// =========================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/howitworks.html');
});

// =========================
// DATABASE SETUP
// =========================
db.serialize(() => {

  // USERS
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      parentId INTEGER,
      firstName TEXT,
      nickname TEXT
    )
  `);

  // MOOD CHECKINS
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      mood TEXT,
      timestamp TEXT
    )
  `);

  // MEDICATION MASTER LIST
  db.run(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      medicineName TEXT,
      timeOfDay TEXT
    )
  `);

  // MEDICATION LOGS
  db.run(`
    CREATE TABLE IF NOT EXISTS medication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      medicationId INTEGER,
      taken TEXT,
      timestamp TEXT
    )
  `);

  // =========================
  // SEED DATA
  // =========================

  db.run(`
    INSERT OR IGNORE INTO users 
    (id, username, password, role, firstName)
    VALUES (1,'user','1234','user','John')
  `);

  db.run(`
    INSERT OR IGNORE INTO users 
    (username,password,role,parentId,firstName)
    VALUES ('family','1234','family',1,'Sarah')
  `);

  db.run(`
    INSERT OR IGNORE INTO medications (id,userId,medicineName,timeOfDay)
    VALUES (1,1,'Blood Pressure','Morning')
  `);

  db.run(`
    INSERT OR IGNORE INTO medications (id,userId,medicineName,timeOfDay)
    VALUES (2,1,'Vitamin D','Evening')
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
// SAVE MOOD
// =========================
app.post('/checkin', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({ success: false });

  const { mood } = req.body;

  db.run(
    `INSERT INTO checkins (userId,mood,timestamp)
     VALUES (?,?,?)`,
    [user.id, mood, new Date().toISOString()]
  );

  res.json({ success: true });
});

// =========================
// GET USER MEDS
// =========================
app.get('/my-medications', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({ meds: [], logs: [] });

  db.all(
    `SELECT * FROM medications WHERE userId=?`,
    [user.id],
    (err, meds) => {

      db.all(
        `SELECT * FROM medication_logs WHERE userId=?`,
        [user.id],
        (err2, logs) => {

          res.json({
            meds: meds || [],
            logs: logs || []
          });

        }
      );
    }
  );
});

// =========================
// MARK MED TAKEN
// =========================
app.post('/take-med', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({ success: false });

  const { medicationId } = req.body;

  db.run(
    `INSERT INTO medication_logs 
     (userId, medicationId, taken, timestamp)
     VALUES (?,?,?,?)`,
    [user.id, medicationId, "Yes", new Date().toISOString()]
  );

  res.json({ success: true });
});

// =========================
// TODAY STATUS (NEW)
// =========================
app.get('/today-status', (req, res) => {

  const user = req.session.user;
  if (!user) return res.json({});

  const today = new Date().toDateString();

  db.get(
    `SELECT * FROM checkins WHERE userId=? ORDER BY timestamp DESC LIMIT 1`,
    [user.id],
    (err, checkin) => {

      const moodToday = checkin &&
        new Date(checkin.timestamp).toDateString() === today;

      db.all(
        `SELECT * FROM medication_logs WHERE userId=?`,
        [user.id],
        (err2, meds) => {

          const medToday = meds.some(m =>
            new Date(m.timestamp).toDateString() === today
          );

          res.json({
            moodToday,
            medToday
          });

        }
      );

    }
  );
});

// =========================
// FAMILY DASHBOARD
// =========================
app.get('/family-data', (req, res) => {

  const u = req.session.user;
  if (!u || u.role !== 'family') return res.json({});

  const targetId = u.parentId;

  db.get(
    `SELECT firstName, nickname FROM users WHERE id=?`,
    [targetId],
    (err, userInfo) => {

      db.all(
        `SELECT * FROM checkins WHERE userId=? ORDER BY timestamp DESC`,
        [targetId],
        (err2, checkins) => {

          db.all(
            `SELECT ml.timestamp, m.medicineName 
             FROM medication_logs ml
             JOIN medications m ON ml.medicationId = m.id
             WHERE ml.userId=?`,
            [targetId],
            (err3, meds) => {

              res.json({
                user: userInfo,
                checkins: checkins || [],
                meds: meds || []
              });

            }
          );

        }
      );

    }
  );
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
