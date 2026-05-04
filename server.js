const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

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
// INIT DATABASE
// =========================
async function initDB(){

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

  // 🔥 FIX
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

  // seed user if empty
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
// PAGE ROUTES (HTML)
// =========================
app.get('/', (req,res)=>{
  res.sendFile(__dirname + '/login.html');
});

app.get('/home', (req,res)=>{
  res.sendFile(__dirname + '/home.html');
});

app.get('/activities', (req,res)=>{
  res.sendFile(__dirname + '/activities.html');
});

// =========================
// LOGIN
// =========================
app.post('/login', async (req,res)=>{

  const { username, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM clients WHERE username=$1 AND password=$2`,
    [username, password]
  );

  const user = result.rows[0];

  if(!user){
    return res.json({success:false});
  }

  req.session.user = user;

  res.json({success:true});
});

// =========================
// ACTIVITIES API (FIXED)
// =========================
app.post('/api/activities', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { dayForCall, timeForCall, timezone } = req.body;

  await pool.query(
    `INSERT INTO activities (clientid, dayforcall, timeforcall, timezone)
     VALUES ($1,$2,$3,$4)`,
    [user.id, dayForCall, timeForCall, timezone]
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