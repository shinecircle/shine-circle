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

  // CLIENTS
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

  // SEED TEST USER
  await pool.query(`
    INSERT INTO clients (id, firstname, lastname, role, password)
    VALUES (1,'John','Doe','user','1234')
    ON CONFLICT DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO clients (firstname, lastname, role, password)
    VALUES ('Sarah','Caregiver','caregiver','1234')
    ON CONFLICT DO NOTHING;
  `);

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

  const { firstname, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM clients WHERE firstname=$1 AND password=$2`,
    [firstname, password]
  );

  const user = result.rows[0];

  if(!user) return res.json({success:false});

  req.session.user = user;

  res.json({success:true, role:user.role});
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

// LOG MED TAKEN
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
