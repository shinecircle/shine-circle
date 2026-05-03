const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const db = new sqlite3.Database('./data.db');

// =========================
// POSTGRES CONNECTION
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =========================
// MIDDLEWARE
@@ -12,289 +21,264 @@ app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(
  session({
    secret: 'shinecare-secret',
    resave: false,
    saveUninitialized: false
  })
);
app.use(session({
  secret: 'shinecare-secret',
  resave: false,
  saveUninitialized: false
}));

// =========================
// ROOT ROUTE
// INIT DATABASE (RUN ON START)
// =========================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/howitworks.html');
});
async function initDB(){

// =========================
// DATABASE SETUP
// =========================
db.serialize(() => {

  // USERS
  db.run(`
  await pool.query(`
   CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id SERIAL PRIMARY KEY,
     username TEXT UNIQUE,
     password TEXT,
     role TEXT,
     parentId INTEGER,
     firstName TEXT,
     nickname TEXT
    )
    );
 `);

  // MOOD CHECKINS
  db.run(`
  await pool.query(`
   CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id SERIAL PRIMARY KEY,
     userId INTEGER,
     mood TEXT,
     timestamp TEXT
    )
    );
 `);

  // MEDICATION MASTER LIST
  db.run(`
  await pool.query(`
   CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id SERIAL PRIMARY KEY,
     userId INTEGER,
     medicineName TEXT,
     timeOfDay TEXT
    )
    );
 `);

  // MEDICATION LOGS
  db.run(`
  await pool.query(`
   CREATE TABLE IF NOT EXISTS medication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id SERIAL PRIMARY KEY,
     userId INTEGER,
     medicationId INTEGER,
     taken TEXT,
     timestamp TEXT
    )
    );
 `);

  // =========================
  // SEED DATA
  // =========================

  db.run(`
    INSERT OR IGNORE INTO users 
    (id, username, password, role, firstName)
  // SEED USERS
  await pool.query(`
    INSERT INTO users (id, username, password, role, firstName)
   VALUES (1,'user','1234','user','John')
    ON CONFLICT DO NOTHING;
 `);

  db.run(`
    INSERT OR IGNORE INTO users 
    (username,password,role,parentId,firstName)
  await pool.query(`
    INSERT INTO users (username,password,role,parentId,firstName)
   VALUES ('family','1234','family',1,'Sarah')
    ON CONFLICT DO NOTHING;
 `);

  db.run(`
    INSERT OR IGNORE INTO medications (id,userId,medicineName,timeOfDay)
  // SEED MEDS
  await pool.query(`
    INSERT INTO medications (id,userId,medicineName,timeOfDay)
   VALUES (1,1,'Blood Pressure','Morning')
    ON CONFLICT DO NOTHING;
 `);

  db.run(`
    INSERT OR IGNORE INTO medications (id,userId,medicineName,timeOfDay)
  await pool.query(`
    INSERT INTO medications (id,userId,medicineName,timeOfDay)
   VALUES (2,1,'Vitamin D','Evening')
    ON CONFLICT DO NOTHING;
 `);

}

initDB();

// =========================
// ROOT
// =========================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/howitworks.html');
});

// =========================
// LOGIN
// =========================
app.post('/login', (req, res) => {
app.post('/login', async (req, res) => {

const { username, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE username=? AND password=?`,
    [username, password],
    (err, user) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE username=$1 AND password=$2`,
    [username, password]
  );

      if (!user) return res.json({ success: false });
  const user = result.rows[0];

      req.session.user = user;
  if (!user) return res.json({ success:false });

      res.json({
        success: true,
        role: user.role
      });
    }
  );
  req.session.user = user;

  res.json({
    success:true,
    role:user.role
  });
});

// =========================
// AUTH / LOGOUT
// =========================
app.get('/auth', (req, res) => {
app.get('/auth', (req,res)=>{
res.json(req.session.user || null);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
app.get('/logout', (req,res)=>{
  req.session.destroy(()=>res.json({success:true}));
});

// =========================
// SAVE MOOD
// =========================
app.post('/checkin', (req, res) => {
app.post('/checkin', async (req,res)=>{

const user = req.session.user;
  if (!user) return res.json({ success: false });
  if(!user) return res.json({success:false});

const { mood } = req.body;

  db.run(
  await pool.query(
`INSERT INTO checkins (userId,mood,timestamp)
     VALUES (?,?,?)`,
     VALUES ($1,$2,$3)`,
[user.id, mood, new Date().toISOString()]
);

  res.json({ success: true });
  res.json({success:true});
});

// =========================
// GET USER MEDS
// GET MEDS
// =========================
app.get('/my-medications', (req, res) => {
app.get('/my-medications', async (req,res)=>{

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
  if(!user) return res.json({meds:[],logs:[]});

  const meds = await pool.query(
    `SELECT * FROM medications WHERE userId=$1`,
    [user.id]
);

  const logs = await pool.query(
    `SELECT * FROM medication_logs WHERE userId=$1`,
    [user.id]
  );

  res.json({
    meds: meds.rows,
    logs: logs.rows
  });
});

// =========================
// MARK MED TAKEN
// TAKE MED
// =========================
app.post('/take-med', (req, res) => {
app.post('/take-med', async (req,res)=>{

const user = req.session.user;
  if (!user) return res.json({ success: false });
  if(!user) return res.json({success:false});

const { medicationId } = req.body;

  db.run(
  await pool.query(
`INSERT INTO medication_logs 
     (userId, medicationId, taken, timestamp)
     VALUES (?,?,?,?)`,
     (userId,medicationId,taken,timestamp)
     VALUES ($1,$2,$3,$4)`,
[user.id, medicationId, "Yes", new Date().toISOString()]
);

  res.json({ success: true });
  res.json({success:true});
});

// =========================
// TODAY STATUS (NEW)
// TODAY STATUS
// =========================
app.get('/today-status', (req, res) => {
app.get('/today-status', async (req,res)=>{

const user = req.session.user;
  if (!user) return res.json({});
  if(!user) return res.json({});

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
  const checkins = await pool.query(
    `SELECT * FROM checkins WHERE userId=$1 ORDER BY timestamp DESC LIMIT 1`,
    [user.id]
  );

          const medToday = meds.some(m =>
            new Date(m.timestamp).toDateString() === today
          );
  const checkin = checkins.rows[0];

          res.json({
            moodToday,
            medToday
          });
  const moodToday = checkin &&
    new Date(checkin.timestamp).toDateString() === today;

        }
      );
  const meds = await pool.query(
    `SELECT * FROM medication_logs WHERE userId=$1`,
    [user.id]
  );

    }
  const medToday = meds.rows.some(m =>
    new Date(m.timestamp).toDateString() === today
);

  res.json({ moodToday, medToday });
});

// =========================
// FAMILY DASHBOARD
// =========================
app.get('/family-data', (req, res) => {
app.get('/family-data', async (req,res)=>{

const u = req.session.user;
  if (!u || u.role !== 'family') return res.json({});
  if(!u || u.role !== 'family') return res.json({});

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
  const userInfo = await pool.query(
    `SELECT firstName,nickname FROM users WHERE id=$1`,
    [targetId]
  );

  const checkins = await pool.query(
    `SELECT * FROM checkins WHERE userId=$1 ORDER BY timestamp DESC`,
    [targetId]
  );

  const meds = await pool.query(
    `SELECT ml.timestamp, m.medicineName 
     FROM medication_logs ml
     JOIN medications m ON ml.medicationId = m.id
     WHERE ml.userId=$1`,
    [targetId]
);

  res.json({
    user: userInfo.rows[0],
    checkins: checkins.rows,
    meds: meds.rows
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
app.listen(PORT, ()=>{
console.log('Server running on port ' + PORT);
});
