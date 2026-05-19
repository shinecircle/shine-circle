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

    // CALLS TABLE
    await pool.query(
      "CREATE TABLE IF NOT EXISTS calls (" +
      "id SERIAL PRIMARY KEY," +
      "clientid INTEGER," +
      "callername TEXT," +
      "calldate TEXT," +
      "starttime TEXT," +
      "endtime TEXT," +
      "timezone TEXT," +
      "status TEXT" +
      ");"
    );

    // FIX OLD TABLES
    await pool.query(
      "ALTER TABLE activities " +
      "ADD COLUMN IF NOT EXISTS clientid INTEGER;"
    );

    await pool.query(
      "ALTER TABLE activities " +
      "ADD COLUMN IF NOT EXISTS dayforcall TEXT;"
    );

    await pool.query(
      "ALTER TABLE activities " +
      "ADD COLUMN IF NOT EXISTS timeforcall TEXT;"
    );

    await pool.query(
      "ALTER TABLE activities " +
      "ADD COLUMN IF NOT EXISTS timezone TEXT;"
    );

    // FIX CALL TABLES
    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS clientid INTEGER;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS callername TEXT;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS calldate TEXT;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS starttime TEXT;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS endtime TEXT;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS timezone TEXT;"
    );

    await pool.query(
      "ALTER TABLE calls " +
      "ADD COLUMN IF NOT EXISTS status TEXT;"
    );

    // DEFAULT USERS
    const existingUsers = await pool.query(
      "SELECT * FROM clients"
    );

    if (existingUsers.rows.length === 0) {

      await pool.query(
        "INSERT INTO clients " +
        "(username, firstname, lastname, role, password) " +
        "VALUES " +
        "('user','John','Doe','user','1234')," +
        "('family','Sarah','Doe','family','1234');"
      );

    }

    // SAMPLE CALL
    const existingCalls = await pool.query(
      "SELECT * FROM calls"
    );

    if(existingCalls.rows.length === 0){

      await pool.query(
        "INSERT INTO calls " +
        "(clientid, callername, calldate, starttime, endtime, timezone, status) " +
        "VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          1,
          "Sarah",
          "Friday, May 22, 2026",
          "7:00 PM",
          "7:30 PM",
          "EST",
          "scheduled"
        ]
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

app.get('/activities', (req, res) => {
  res.sendFile(path.join(__dirname, 'activities.html'));
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

    const result = await pool.query(
      "SELECT * FROM clients WHERE LOWER(username)=LOWER($1) AND password=$2",
      [
        req.body.username,
        req.body.password
      ]
    );

    const user = result.rows[0];

    if (!user) {

      return res.json({
        success:false
      });

    }

    req.session.user = user;

    res.json({
      success:true,
      role:user.role
    });

  }

  catch(err){

    console.log(err);

    res.json({
      success:false
    });

  }

});

// =========================
// LOGOUT
// =========================
app.get('/logout', (req,res)=>{

  req.session.destroy(()=>{
    res.send("Logged out");
  });

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
        req.body.dayForCall,
        req.body.timeForCall,
        req.body.timezone
      ]
    );

    res.json({
      success:true
    });

  }

  catch(err){

    console.log(err);

    res.json({
      success:false
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

  catch(err){

    console.log(err);

    res.json({});

  }

});

// =========================
// NEXT CALL
// =========================
app.get('/api/next-call', async (req, res) => {

  try {

    const user = req.session.user;

    if (!user) {

      return res.json({});

    }

    const result = await pool.query(
      "SELECT * FROM calls " +
      "WHERE clientid=$1 " +
      "AND status='scheduled' " +
      "ORDER BY id ASC " +
      "LIMIT 1",
      [user.id]
    );

    res.json(
      result.rows[0] || {}
    );

  }

  catch(err){

    console.log(err);

    res.json({});

  }

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