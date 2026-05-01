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

app.use(session({
  secret: 'shinecare-secret',
  resave: false,
  saveUninitialized: false
}));

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
      lastName TEXT,
      nickname TEXT,
      phone TEXT,
      email TEXT,
      timezone TEXT,
      interests TEXT,
      priorCareer TEXT,
      retired TEXT
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

  // MEDICATIONS
  db.run(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      medicineName TEXT,
      timeOfDay TEXT,
      taken TEXT,
      timestamp TEXT
    )
  `);

  // CALL LOGS
  db.run(`
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      callWith TEXT,
      startTime TEXT,
      endTime TEXT,
      duration INTEGER
    )
  `);

  // SEED USERS
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
});

// =========================
// LOGIN
// =========================
app.post('/login', (req,res)=>{
  const {username,password} = req.body;

  db.get(
    `SELECT * FROM users WHERE username=? AND password=?`,
    [username,password],
    (err,user)=>{
      if(!user) return res.json({success:false});

      req.session.user = user;

      res.json({success:true, role:user.role});
    }
  );
});

// =========================
// CHECKIN (MOOD)
// =========================
app.post('/checkin',(req,res)=>{
  const user = req.session.user;
  if(!user) return res.json({success:false});

  const {mood} = req.body;

  db.run(
    `INSERT INTO checkins (userId,mood,timestamp)
     VALUES (?,?,?)`,
    [user.id, mood, new Date().toISOString()]
  );

  res.json({success:true});
});

// =========================
// MEDICATION
// =========================
app.post('/medication',(req,res)=>{
  const user = req.session.user;
  if(!user) return res.json({success:false});

  const {medicineName,timeOfDay,taken} = req.body;

  db.run(
    `INSERT INTO medications 
     (userId,medicineName,timeOfDay,taken,timestamp)
     VALUES (?,?,?,?,?)`,
    [user.id,medicineName,timeOfDay,taken,new Date().toISOString()]
  );

  res.json({success:true});
});

// =========================
// CALL LOGGING
// =========================
app.post('/call',(req,res)=>{
  const user = req.session.user;
  if(!user) return res.json({success:false});

  const {callWith,startTime,endTime} = req.body;

  const duration =
    (new Date(endTime) - new Date(startTime)) / 1000;

  db.run(
    `INSERT INTO calls (userId,callWith,startTime,endTime,duration)
     VALUES (?,?,?,?,?)`,
    [user.id,callWith,startTime,endTime,duration]
  );

  res.json({success:true});
});

// =========================
// FAMILY DASHBOARD
// =========================
app.get('/family-data',(req,res)=>{
  const u = req.session.user;
  if(!u || u.role !== 'family'){
    return res.json({});
  }

  const targetId = u.parentId;

  db.all(
    `SELECT * FROM checkins WHERE userId=? ORDER BY timestamp DESC`,
    [targetId],
    (err,checkins)=>{

      db.all(
        `SELECT * FROM medications WHERE userId=?`,
        [targetId],
        (err2,meds)=>{

          db.all(
            `SELECT * FROM calls WHERE userId=?`,
            [targetId],
            (err3,calls)=>{

              res.json({
                checkins:checkins || [],
                meds:meds || [],
                calls:calls || []
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

app.listen(PORT,()=>{
  console.log('Server running on port ' + PORT);
});
