JavaScript

app.get ('test', (req,res)=>{
  res.send("TEST WORKING");
});

const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();

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
  cookie: { secure: false }
}));

// =========================
// INIT DATABASE
// =========================
async function initDB(){

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

  // ensure column exists (safe)
  await pool.query(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS username TEXT;
  `);

  // ensure at least 2 users exist
  const result = await pool.query(`SELECT * FROM clients`);

  if(result.rows.length === 0){
    await pool.query(`
      INSERT INTO clients (username, firstname, lastname, role, password)
      VALUES
      ('user','John','Doe','user','1234'),
      ('family','Sarah','Doe','caregiver','1234')
    `);
  }
}

//TEMPORARY RESET
await pool.query('DROP TABLE IF EXISTS activities')}


//ACTIVITIES TABLE
//await pool.query('
  // CREATE TABLE IF NOT EXISTS activities (
//	id SERIAL PRIMARY KEY,
//	clientid INTEGER,
//	dayforcall TEXT,
//	timeforcall TEXT,
//	timezone TEXT
//	);
  // ');

//FIX EXISTING TABLE
//   await pool.query('
//	ALTER TABLE activities
//	ADD COLUMN IF NOT EXISTS clientid INTEGER;
  // ');




initDB().catch(err => console.log(err));

// =========================
// DEBUG ROUTE
// =========================
app.get('/debug-users', async (req,res)=>{
  const result = await pool.query(
    `SELECT id, username, role FROM clients ORDER BY id`
  );
  res.json(result.rows);
});

// =========================
// PAGE ROUTES
// =========================
app.get('/', (req,res)=>{
  res.sendFile(__dirname + '/login.html');
});

app.get('/home', (req,res)=>{
  res.sendFile(__dirname + '/home.html');
});

app.get('/family', (req,res)=>{
  res.sendFile(__dirname + '/family.html');
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

  res.json({
    success:true,
    role:user.role
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running on port " + PORT);
});
