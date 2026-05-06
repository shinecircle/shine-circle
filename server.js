const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.set('trust proxy', 1);

// =========================
// DATABASE
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
// INIT DB
// =========================
async function initDB() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      username TEXT,
      role TEXT,
      password TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      clientid INTEGER,
      mood TEXT,
      meds TEXT,
      date TEXT
    );
  `);

  const r = await pool.query(`SELECT * FROM clients`);
  if (r.rows.length === 0) {
    await pool.query(`
      INSERT INTO clients (username, role, password)
      VALUES 
      ('user','user','1234'),
      ('family','caregiver','1234')
    `);
  }
}

initDB();

// =========================
// LOGIN
// =========================
app.post('/login', async (req,res)=>{
  const { username, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM clients WHERE username=$1 AND password=$2`,
    [username,password]
  );

  const user = result.rows[0];
  if(!user) return res.json({success:false});

  req.session.user = user;

  console.log("LOGIN SUCCESS:", user);

  res.json({success:true});
});

// =========================
// AUTH
// =========================
app.get('/auth',(req,res)=>{
  console.log("AUTH SESSION:", req.session.user);
  res.json(req.session.user || null);
});

// =========================
// SAVE CHECKIN
// =========================
app.post('/checkin', async (req,res)=>{
  try {

    console.log("SESSION ON SAVE:", req.session.user);

    const user = req.session.user;
    if(!user) return res.status(401).json({success:false});

    const { mood, meds } = req.body;

    const today = new Date().toISOString().split('T')[0];

    console.log("SAVING:", user.id, mood, meds, today);

    await pool.query(
      `DELETE FROM checkins WHERE clientid=$1 AND date=$2`,
      [user.id, today]
    );

    await pool.query(
      `INSERT INTO checkins (clientid,mood,meds,date)
       VALUES ($1,$2,$3,$4)`,
      [user.id, mood, meds, today]
    );

    res.json({success:true});

  } catch(err){
    console.log("SAVE ERROR:", err);
    res.status(500).json({success:false});
  }
});

// =========================
// LOAD CHECKIN
// =========================
app.get('/checkin-today', async (req,res)=>{
  try {

    console.log("SESSION ON LOAD:", req.session.user);

    const user = req.session.user;
    if(!user) return res.json({checkedIn:false});

    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT * FROM checkins WHERE clientid=$1 AND date=$2`,
      [user.id, today]
    );

    console.log("DB RESULT:", result.rows);

    const c = result.rows[0];

    if(!c) return res.json({checkedIn:false});

    res.json({
      checkedIn:true,
      mood:c.mood,
      meds:c.meds
    });

  } catch(err){
    console.log("LOAD ERROR:", err);
    res.json({checkedIn:false});
  }
});

// =========================
// PAGES
// =========================
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'login.html')));
app.get('/home',(req,res)=>res.sendFile(path.join(__dirname,'home.html')));
app.get('/checkin',(req,res)=>res.sendFile(path.join(__dirname,'checkin.html')));

// =========================
// START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("SERVER RUNNING", PORT);
});