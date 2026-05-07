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
// INIT DATABASE
// =========================
async function initDB(){

  try{

    // USERS
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

    // CHECKINS
    await pool.query(`

      CREATE TABLE IF NOT EXISTS checkins (

        id SERIAL PRIMARY KEY,

        clientid INTEGER,

        date TEXT,

        mood TEXT,

        meds TEXT

      );

    `);

    // SEED USERS
    const result =
      await pool.query(`SELECT * FROM clients`);

    if(result.rows.length === 0){

      await pool.query(`

        INSERT INTO clients
        (username, firstname, lastname, role, password)

        VALUES

        ('user','John','Doe','user','1234'),

        ('family','Sarah','Doe','caregiver','1234')

      `);

      console.log("Seed users created");

    }

    console.log("Database initialized");

  }

  catch(err){

    console.log("DB INIT ERROR");
    console.log(err);

  }

}

initDB();

// =========================
// AUTH
// =========================
app.get('/auth', (req,res)=>{

  res.json(req.session.user || null);

});

app.get('/logout', (req,res)=>{

  req.session.destroy(()=>{

    res.json({
      success:true
    });

  });

});

// =========================
// PAGES
// =========================
app.get('/', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'howitworks.html')
  );

});

app.get('/login', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'login.html')
  );

});

app.get('/home', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'home.html')
  );

});

app.get('/family', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'family.html')
  );

});

app.get('/checkin', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'checkin.html')
  );

});

app.get('/activities', (req,res)=>{

  res.sendFile(
    path.join(__dirname,'activities.html')
  );

});

// =========================
// LOGIN
// =========================
app.post('/login', async (req,res)=>{

  try{

    const {
      username,
      password
    } = req.body;

    const result = await pool.query(

      `SELECT * FROM clients
       WHERE username=$1
       AND password=$2`,

      [username, password]

    );

    const user = result.rows[0];

    if(!user){

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

    res.status(500).json({
      success:false
    });

  }

});

// =========================
// SAVE CHECKIN
// =========================
app.post('/checkin', async (req,res)=>{

  try{

    const user = req.session.user;

    if(!user){

      return res.status(401).json({

        success:false,

        message:'Not logged in'

      });

    }

    const {
      mood,
      meds
    } = req.body;

    const today =
      new Date().toISOString().split('T')[0];

    // FIND EXISTING ROW
    const existing = await pool.query(

      `SELECT * FROM checkins
       WHERE clientid=$1
       AND date=$2`,

      [user.id, today]

    );

    // =========================
    // CREATE NEW ROW
    // =========================
    if(existing.rows.length === 0){

      await pool.query(

        `INSERT INTO checkins
        (clientid, date, mood, meds)

        VALUES ($1,$2,$3,$4)`,

        [
          user.id,
          today,
          mood || null,
          meds || null
        ]

      );

      console.log("Created new checkin");

    }

    // =========================
    // UPDATE EXISTING ROW
    // =========================
    else{

      if(mood){

        await pool.query(

          `UPDATE checkins

           SET mood=$1

           WHERE clientid=$2
           AND date=$3`,

          [
            mood,
            user.id,
            today
          ]

        );

        console.log("Updated mood");

      }

      if(meds){

        await pool.query(

          `UPDATE checkins

           SET meds=$1

           WHERE clientid=$2
           AND date=$3`,

          [
            meds,
            user.id,
            today
          ]

        );

        console.log("Updated meds");

      }

    }

    // =========================
    // VERIFY SAVED DATA
    // =========================
    const saved = await pool.query(

      `SELECT * FROM checkins
       WHERE clientid=$1
       AND date=$2`,

      [user.id, today]

    );

    console.log("Saved row:");
    console.log(saved.rows[0]);

    // SUCCESS RESPONSE
    res.json({

      success:true,

      saved:saved.rows[0]

    });

  }

  catch(err){

    console.log("CHECKIN SAVE ERROR");
    console.log(err);

    res.status(500).json({

      success:false,

      error:err.message

    });

  }

});

// =========================
// LOAD TODAY CHECKIN
// =========================
app.get('/checkin-today', async (req,res)=>{

  try{

    const user = req.session.user;

    if(!user){

      return res.json({
        checkedIn:false
      });

    }

    const today =
      new Date().toISOString().split('T')[0];

    const result = await pool.query(

      `SELECT * FROM checkins
       WHERE clientid=$1
       AND date=$2`,

      [user.id, today]

    );

    // NO RECORD
    if(result.rows.length === 0){

      return res.json({
        checkedIn:false
      });

    }

    const c = result.rows[0];

    console.log("Loaded checkin:");
    console.log(c);

    // RETURN SAVED DATA
    res.json({

      checkedIn:true,

      mood:c.mood,

      meds:c.meds,

      date:c.date

    });

  }

  catch(err){

    console.log("LOAD CHECKIN ERROR");
    console.log(err);

    res.status(500).json({
      checkedIn:false
    });

  }

});

// =========================
// DEBUG ROUTE
// VIEW ALL CHECKINS
// =========================
app.get('/debug-checkins', async (req,res)=>{

  try{

    const result =
      await pool.query(`

        SELECT * FROM checkins
        ORDER BY id DESC

      `);

    res.json(result.rows);

  }

  catch(err){

    console.log(err);

    res.status(500).json({
      success:false
    });

  }

});

// =========================
// SERVER START
// =========================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(
    "Server running on port " + PORT
  );

});