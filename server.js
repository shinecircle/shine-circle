const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();

app.set('trust proxy', 1);

// =========================
// DATABASE CONNECTION
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
  cookie: { secure: false }
}));

// =========================
// INIT DATABASE
// =========================
async function initDB(){

  // CLIENTS TABLE (create if missing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      firstname TEXT,
      lastname TEXT,
      phone TEXT,
      timezone TEXT,
      email TEXT,
      interests TEXT,
      specialties TEXT,
      role TEXT,
      password TEXT
    );
  `);

  // 🔥 CRITICAL FIX: add username column if missing
  await pool.query(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS username TEXT;
  `);

  // CHECKINS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      clientid INTEGER,
      mood TEXT,
      timestamp TEXT
    );
  `);

  // MEDICATIONS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medications (
      id SERIAL PRIMARY KEY,
      clientid INTEGER,
      medicinename TEXT
    );
  `);

  // MEDICATION LOGS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medication_logs (
      id SERIAL PRIMARY KEY,
      clientid INTEGER,
      medicationid INTEGER,
      date TEXT,
      taken TEXT
    );
  `);

  // CONVERSATIONS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      clientid INTEGER,
      withwhom TEXT,
      starttime TEXT,
      endtime TEXT,
      date TEXT
    );
  `);

  // OPTIONAL: seed users ONLY if table is empty
  const existing = await pool.query(`SELECT * FROM clients LIMIT 1`);

  if(existing.rows.length === 0){
    await pool.query(`
      INSERT INTO clients (username, firstname, lastname, role, password)
      VALUES
      ('user','John','Doe','user','1234'),
      ('family','Sarah','Caregiver','caregiver','1234')
    `);
  }
}

initDB().catch(err => console.log(err));

// =========================
// ROOT
// =========================
app.get('/', (req,res)=>{
  res.sendFile(__dirname + '/login.html');
});

// =========================
// LOGIN
// =========================
app.post('/login', async (req,res)=>{

  console.log("LOGIN ATTEMPT:", req.body);

  const { username, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM clients WHERE username=$1 AND password=$2`,
    [username, password]
  );

  console.log("DB RESULT:", result.rows);

  const user = result.rows[0];

  if(!user){
    return res.json({success:false});
  }

  req.session.user = user;

  res.json({success:true, role:user.role});
});

// =========================
// LOGOUT
// =========================
app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.json({success:true}));
});

// =========================
// CHECKIN
// =========================
app.post('/checkin', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { mood } = req.body;

  await pool.query(
    `INSERT INTO checkins (clientid,mood,timestamp)
     VALUES ($1,$2,$3)`,
    [user.id, mood, new Date().toISOString()]
  );

  res.json({success:true});
});

// CHECK TODAY
app.get('/checkin-today', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({});

  const today = new Date().toDateString();

  const result = await pool.query(
    `SELECT * FROM checkins WHERE clientid=$1 ORDER BY timestamp DESC LIMIT 1`,
    [user.id]
  );

  const c = result.rows[0];

  if(c && new Date(c.timestamp).toDateString() === today){
    return res.json({
      checkedIn:true,
      mood:c.mood,
      timestamp:c.timestamp
    });
  }

  res.json({checkedIn:false});
});

// =========================
// MEDICATIONS
// =========================
app.get('/medications', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json([]);

  const result = await pool.query(
    `SELECT * FROM medications WHERE clientid=$1`,
    [user.id]
  );

  res.json(result.rows);
});

// TAKE MED
app.post('/take-med', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { medicationId } = req.body;

  const today = new Date().toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO medication_logs (clientid, medicationid, date, taken)
     VALUES ($1,$2,$3,$4)`,
    [user.id, medicationId, today, 'yes']
  );

  res.json({success:true});
});

// =========================
// CONVERSATIONS
// =========================
app.post('/conversation', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { withWhom, startTime, endTime } = req.body;

  const date = new Date().toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO conversations
     (clientid, withwhom, starttime, endtime, date)
     VALUES ($1,$2,$3,$4,$5)`,
    [user.id, withWhom, startTime, endTime, date]
  );

  res.json({success:true});
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running on port " + PORT);
});