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

  ssl:{
    rejectUnauthorized:false
  }

});

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());

app.use(express.urlencoded({
  extended:true
}));

app.use(express.static(__dirname));

// =========================
// SESSION
// =========================
app.use(session({

  secret:'shine-secret',

  resave:false,

  saveUninitialized:false,

  cookie:{

    secure:false,

    sameSite:'lax',

    maxAge:1000 * 60 * 60 * 24

  }

}));

// =========================
// INIT DATABASE
// =========================
async function initDB(){

  try{

    // USERS TABLE
    await pool.query(`

      CREATE TABLE IF NOT EXISTS clients (

        id SERIAL PRIMARY KEY,

        username TEXT,

        firstname TEXT,

        lastname TEXT,

        role TEXT,

        password TEXT

      )

    `);

    // CHECKINS TABLE
    await pool.query(`

      CREATE TABLE IF NOT EXISTS checkins (

        id SERIAL PRIMARY KEY,

        userid INTEGER,

        date TEXT,

        mood TEXT,

        meds TEXT

      )

    `);

    // SEED USERS
    const users =
      await pool.query(`SELECT * FROM clients`);

    if(users.rows.length === 0){

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

    console.log(err);

  }

}

initDB();

// =========================
// RESET CHECKINS TABLE
// TEMPORARY ROUTE
// VISIT ONCE THEN DELETE
// =========================
app.get('/reset-checkins', async (req,res)=>{

  try{

    // DELETE OLD TABLE
    await pool.query(`

      DROP TABLE IF EXISTS checkins

    `);

    // CREATE NEW TABLE
    await pool.query(`

      CREATE TABLE checkins (

        id SERIAL PRIMARY KEY,

        userid INTEGER,

        date TEXT,

        mood TEXT,

        meds TEXT

      )

    `);

    res.send(
      "checkins table rebuilt successfully"
    );

  }

  catch(err){

    console.log(err);

    res.send(err.message);

  }

});

// =========================
// PAGES
// =========================
app.get('/',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'howitworks.html')
  );

});

app.get('/login',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'login.html')
  );

});

app.get('/home',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'home.html')
  );

});

app.get('/family',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'family.html')
  );

});

app.get('/checkin',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'checkin.html')
  );

});

app.get('/activities',(req,res)=>{

  res.sendFile(
    path.join(__dirname,'activities.html')
  );

});

// =========================
// AUTH
// =========================
app.get('/auth',(req,res)=>{

  res.json({

    user:req.session.user || null

  });

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

      `SELECT *

       FROM clients

       WHERE username=$1

       AND password=$2`,

      [username,password]

    );

    const user = result.rows[0];

    if(!user){

      return res.json({
        success:false
      });

    }

    req.session.user = {

      id:user.id,

      username:user.username,

      role:user.role

    };

    req.session.save(()=>{

      console.log("LOGIN SUCCESS");
      console.log(req.session.user);

      res.json({

        success:true,

        role:user.role

      });

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
// LOGOUT
// =========================
app.get('/logout',(req,res)=>{

  req.session.destroy(()=>{

    res.json({
      success:true
    });

  });

});

// =========================
// SAVE CHECKIN
// =========================
app.post('/api/checkin', async (req,res)=>{

  try{

    console.log("CHECKIN REQUEST");

    const user = req.session.user;

    console.log("SESSION USER:");
    console.log(user);

    console.log("BODY:");
    console.log(req.body);

    if(!user){

      return res.status(401).json({

        success:false,

        error:'Not logged in'

      });

    }

    const {
      mood,
      meds
    } = req.body;

    const today =
      new Date().toISOString().split('T')[0];

    // FIND TODAY'S ROW
    const existing = await pool.query(

      `SELECT *

       FROM checkins

       WHERE userid=$1

       AND date=$2`,

      [user.id, today]

    );

    // CREATE NEW ROW
    if(existing.rows.length === 0){

      await pool.query(

        `INSERT INTO checkins

        (userid, date, mood, meds)

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

    // UPDATE EXISTING ROW
    else{

      if(mood){

        await pool.query(

          `UPDATE checkins

           SET mood=$1

           WHERE userid=$2

           AND date=$3`,

          [

            mood,

            user.id,

            today

          ]

        );

        console.log("Mood updated");

      }

      if(meds){

        await pool.query(

          `UPDATE checkins

           SET meds=$1

           WHERE userid=$2

           AND date=$3`,

          [

            meds,

            user.id,

            today

          ]

        );

        console.log("Medication updated");

      }

    }

    // VERIFY SAVE
    const saved = await pool.query(

      `SELECT *

       FROM checkins

       WHERE userid=$1

       AND date=$2`,

      [user.id, today]

    );

    console.log("SAVED ROW:");
    console.log(saved.rows[0]);

    res.json({

      success:true,

      checkin:saved.rows[0]

    });

  }

  catch(err){

    console.log("CHECKIN ERROR");
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
app.get('/api/checkin-today', async (req,res)=>{

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

      `SELECT *

       FROM checkins

       WHERE userid=$1

       AND date=$2`,

      [user.id, today]

    );

    if(result.rows.length === 0){

      return res.json({
        checkedIn:false
      });

    }

    const c = result.rows[0];

    res.json({

      checkedIn:true,

      mood:c.mood,

      meds:c.meds

    });

  }

  catch(err){

    console.log(err);

    res.status(500).json({

      checkedIn:false

    });

  }

});

// =========================
// DEBUG ROUTES
// =========================
app.get('/debug-columns', async (req,res)=>{

  try{

    const result = await pool.query(`

      SELECT column_name

      FROM information_schema.columns

      WHERE table_name='checkins'

    `);

    res.json(result.rows);

  }

  catch(err){

    console.log(err);

    res.json({
      error:err.message
    });

  }

});

app.get('/debug-checkins', async (req,res)=>{

  try{

    const result = await pool.query(`

      SELECT *

      FROM checkins

      ORDER BY id DESC

    `);

    res.json(result.rows);

  }

  catch(err){

    console.log(err);

    res.json({
      error:err.message
    });

  }

});

// =========================
// START SERVER
// =========================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(
    "Server running on port " + PORT
  );

});