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
  secret: 'shinecare-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// =========================
// INIT DATABASE
// =========================
async function initDB(){

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      parentId INTEGER,
      firstname TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      userid INTEGER,
      mood TEXT,
      timestamp TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS medications (
      id SERIAL PRIMARY KEY,
      userid INTEGER,
      medicinename TEXT,
      timeofday TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS medication_logs (
      id SERIAL PRIMARY KEY,
      userid INTEGER,
      medicationid INTEGER,
      timestamp TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      userid INTEGER,
      dayforcall TEXT,
      timeforcall TEXT,
      timezone TEXT
    );
  `);

  // seed users
  await pool.query(`
    INSERT INTO users (id, username, password, role, firstname)
    VALUES (1,'user','1234','user','John')
    ON CONFLICT DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO users (username,password,role,parentId,firstname)
    VALUES ('family','1234','family',1,'Sarah')
    ON CONFLICT DO NOTHING;
  `);

  // seed meds
  await pool.query(`
    INSERT INTO medications (id,userid,medicinename,timeofday)
    VALUES (1,1,'Blood Pressure','Morning')
    ON CONFLICT DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO medications (id,userid,medicinename,timeofday)
    VALUES (2,1,'Vitamin D','Evening')
    ON CONFLICT DO NOTHING;
  `);
}

// run safely
initDB().catch(err => {
  console.error("DB INIT ERROR:", err);
});

// =========================
// ROOT (FIXES BLANK PAGE)
// =========================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

// =========================
// LOGIN
// =========================
app.post('/login', async (req,res)=>{

  const { username, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM users WHERE username=$1 AND password=$2`,
    [username,password]
  );

  const user = result.rows[0];

  if(!user) return res.json({success:false});

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
app.get('/checkin-today', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({});

  const today = new Date().toDateString();

  const result = await pool.query(
    `SELECT * FROM checkins WHERE userid=$1 ORDER BY timestamp DESC LIMIT 1`,
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

app.post('/checkin', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { mood } = req.body;

  await pool.query(
    `INSERT INTO checkins (userid,mood,timestamp)
     VALUES ($1,$2,$3)`,
    [user.id, mood, new Date().toISOString()]
  );

  res.json({success:true});
});

// =========================
// MEDICATIONS
// =========================
app.get('/my-medications', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({meds:[],logs:[]});

  const meds = await pool.query(
    `SELECT * FROM medications WHERE userid=$1`,
    [user.id]
  );

  const logs = await pool.query(
    `SELECT * FROM medication_logs WHERE userid=$1`,
    [user.id]
  );

  res.json({
    meds: meds.rows,
    logs: logs.rows
  });
});

app.post('/take-med', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { medicationId } = req.body;

  await pool.query(
    `INSERT INTO medication_logs (userid,medicationid,timestamp)
     VALUES ($1,$2,$3)`,
    [user.id, medicationId, new Date().toISOString()]
  );

  res.json({success:true});
});

// =========================
// ACTIVITIES
// =========================
app.get('/activities', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({});

  const result = await pool.query(
    `SELECT * FROM activities WHERE userid=$1`,
    [user.id]
  );

  res.json(result.rows[0] || {});
});

app.post('/activities', async (req,res)=>{

  const user = req.session.user;
  if(!user) return res.json({success:false});

  const { dayForCall, timeForCall, timezone } = req.body;

  await pool.query(`DELETE FROM activities WHERE userid=$1`, [user.id]);

  await pool.query(
    `INSERT INTO activities (userid,dayforcall,timeforcall,timezone)
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
