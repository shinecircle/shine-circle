const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// =========================
// TRUST PROXY
// =========================
app.set('trust proxy', 1);

// =========================
// DATABASE
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.use(express.static(__dirname));

app.use(session({
  secret: 'shine-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}));

// =========================
// DATABASE INIT
// =========================
async function initDB() {

  try {

    console.log("Initializing database...");

    // CLIENTS TABLE
    await pool.query(
      "CREATE TABLE IF NOT EXISTS clients (" +
      "id SERIAL PRIMARY KEY," +
      "username TEXT," +
      "firstname TEXT," +
      "lastname TEXT," +
      "role TEXT," +
      "password TEXT" +
      ");"
    );

    // CHECKINS TABLE
    await pool.query(
      "CREATE TABLE IF NOT EXISTS checkins (" +
      "id SERIAL PRIMARY KEY," +
      "clientid INTEGER," +
      "date TEXT," +
      "mood TEXT," +
      "meds TEXT" +
      ");"
    );

    // FIX OLD CHECKINS TABLES
    await pool.query(
      "ALTER TABLE checkins " +
      "ADD COLUMN IF NOT EXISTS clientid INTEGER;"
    );

    // ACTIVITIES TABLE
    await pool.query(
      "CREATE TABLE IF NOT EXISTS activities (" +
      "id SERIAL PRIMARY KEY," +
      "clientid INTEGER," +
      "dayforcall TEXT," +
      "timeforcall TEXT," +
      "timezone TEXT" +
      ");"
    );

    // FIX OLD ACTIVITIES TABLES
    await pool.query(
      "ALTER TABLE activities " +
      "ADD COLUMN IF NOT EXISTS clientid INTEGER;"
    );

    // CHECK USERS
    const existingUsers = await pool.query(
      "SELECT * FROM clients"
    );

    // DEFAULT USERS
    if (existingUsers.rows.length === 0) {

      console.log("Creating default users...");

      await pool.query(
        "INSERT INTO clients " +
        "(username, firstname, lastname, role, password) " +
        "VALUES " +
        "('user','John','Doe','user','1234')," +
        "('family','Sarah','Doe','family','1234');"
      );

    }

    console.log("Database ready.");

  }

  catch (err) {

    console.log("DB INIT ERROR:");
    console.log(err);

  }

}

initDB();

// =========================
// PAGE ROUTES
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'howitworks.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/checkin', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkin.html'));
});

app.get('/activities', (req, res) => {
  res.sendFile(path.join(__dirname, 'activities.html'));
});

app.get('/family', (req, res) => {
  res.sendFile(path.join(__dirname, 'family.html'));
});

// =========================
// HEADER
// =========================
app.get('/header', (req, res) => {
  res.sendFile(path.join(__dirname, 'header.html'));
});

// =========================
// AUTH
// =========================
app.get('/auth', (req, res) => {
  res.json(req.session.user || null);
});

// =========================
// LOGIN
// =========================
app.post('/login', async (req, res) => {

  try {

    const username = req.body.username;
    const password = req.body.password;

    const result = await pool.query(
      "SELECT * FROM clients WHERE username=$1 AND password=$2",
      [username, password]
    );

    const user = result.rows[0];

    if (!user) {

      return res.json({
        success: false
      });

    }

    req.session.user = user;

    console.log("LOGIN SUCCESS:", user.username);

    res.json({
      success: true,
      role: user.role
    });

  }

  catch (err) {

    console.log(err);

    res.status(500).json({
      success: false
    });

  }

});

// =========================
// LOGOUT
// =========================
app.get('/logout', (req, res) => {

  req.session.destroy(() => {
    res.send("Logged out");
  });

});

// =========================
// SAVE CHECKIN
// =========================
app.post('/api/checkin', async (req, res) => {

  try {

    console.log("CHECKIN BODY:", req.body);

    const user = req.session.user;

    console.log("SESSION USER:", user);

    if (!user) {

      return res.status(401).json({
        success: false,
        error: "No session user"
      });

    }

    const today =
      new Date().toISOString().split('T')[0];

    const mood = req.body.mood;
    const meds = req.body.meds;

    const existing = await pool.query(
      "SELECT * FROM checkins WHERE clientid=$1 AND date=$2",
      [user.id, today]
    );

    // INSERT
    if (existing.rows.length === 0) {

      await pool.query(
        "INSERT INTO checkins " +
        "(clientid, date, mood, meds) " +
        "VALUES($1,$2,$3,$4)",
        [
          user.id,
          today,
          mood || null,
          meds || null
        ]
      );

    }

    // UPDATE
    else {

      const row = existing.rows[0];

      await pool.query(
        "UPDATE checkins " +
        "SET mood=$1, meds=$2 " +
        "WHERE id=$3",
        [
          mood || row.mood,
          meds || row.meds,
          row.id
        ]
      );

    }

    res.json({
      success: true
    });

  }

  catch (err) {

    console.log("CHECKIN SAVE ERROR:");
    console.log(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// =========================
// LOAD TODAY CHECKIN
// =========================
app.get('/api/checkin-today', async (req, res) => {

  try {

    const user = req.session.user;

    if (!user) {

      return res.json({
        checkedIn: false
      });

    }

    const today =
      new Date().toISOString().split('T')[0];

    const result = await pool.query(
      "SELECT * FROM checkins WHERE clientid=$1 AND date=$2",
      [user.id, today]
    );

    if (result.rows.length === 0) {

      return res.json({
        checkedIn: false
      });

    }

    const row = result.rows[0];

    res.json({
      checkedIn: true,
      mood: row.mood,
      meds: row.meds
    });

  }

  catch (err) {

    console.log(err);

    res.json({
      checkedIn: false
    });

  }

});

// =========================
// SAVE ACTIVITIES
// =========================
app.post('/api/activities', async (req, res) => {

  try {

    const user = req.session.user;

    if (!user) {

      return res.status(401).json({
        success: false
      });

    }

    const dayForCall = req.body.dayForCall;
    const timeForCall = req.body.timeForCall;
    const timezone = req.body.timezone;

    await pool.query(
      "DELETE FROM activities WHERE clientid=$1",
      [user.id]
    );

    await pool.query(
      "INSERT INTO activities " +
      "(clientid, dayforcall, timeforcall, timezone) " +
      "VALUES($1,$2,$3,$4)",
      [
        user.id,
        dayForCall,
        timeForCall,
        timezone
      ]
    );

    res.json({
      success: true
    });

  }

  catch (err) {

    console.log(err);

    res.status(500).json({
      success: false
    });

  }

});

// =========================
// LOAD ACTIVITIES
// =========================
app.get('/api/activities', async (req, res) => {

  try {

    const user = req.session.user;

    if (!user) {

      return res.json({});

    }

    const result = await pool.query(
      "SELECT * FROM activities WHERE clientid=$1",
      [user.id]
    );

    res.json(
      result.rows[0] || {}
    );

  }

  catch (err) {

    console.log(err);

    res.json({});

  }

});

// =========================
// FAMILY DATA
// =========================
app.get('/family-data', async (req, res) => {

  try {

    const userResult = await pool.query(
      "SELECT id, firstname, lastname " +
      "FROM clients " +
      "WHERE role='user' " +
      "LIMIT 1"
    );

    const user = userResult.rows[0];

    if (!user) {

      return res.json({
        user: null,
        checkins: []
      });

    }

    const activityResult = await pool.query(
      "SELECT dayforcall, timeforcall, timezone " +
      "FROM activities " +
      "WHERE clientid=$1 " +
      "LIMIT 1",
      [user.id]
    );

    const activity =
      activityResult.rows[0] || {};

    const checkinsResult = await pool.query(
      "SELECT mood, meds, date as timestamp " +
      "FROM checkins " +
      "WHERE clientid=$1 " +
      "ORDER BY date ASC",
      [user.id]
    );

    res.json({

      user: {

        firstName: user.firstname,

        lastName: user.lastname,

        dayForCall:
          activity.dayforcall || "",

        timeForCall:
          activity.timeforcall || "",

        timezone:
          activity.timezone || ""

      },

      checkins:
        checkinsResult.rows

    });

  }

  catch (err) {

    console.log(err);

    res.json({
      user: null,
      checkins: []
    });

  }

});

// =========================
// DEBUG CHECKINS
// =========================
app.get('/debug-checkins', async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM checkins ORDER BY id DESC"
    );

    res.json(result.rows);

  }

  catch(err){

    console.log(err);

    res.json([]);

  }

});

// =========================
// TEST ROUTE
// =========================
app.get('/test', (req, res) => {
  res.send("TEST WORKING");
});

// =========================
// START SERVER
// =========================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "Server running on port " + PORT
  );

});