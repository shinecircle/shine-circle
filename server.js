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
ssl: {
rejectUnauthorized: false
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

app.use(session({

secret:'shine-secret',

resave:false,

saveUninitialized:false,

cookie:{
secure:false
}

}));

// =========================
// DATABASE INIT
// =========================
async function initDB(){

try{

```
console.log("Initializing database...");

// CLIENTS
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

// ACTIVITIES
await pool.query(`
  CREATE TABLE IF NOT EXISTS activities (

    id SERIAL PRIMARY KEY,

    clientid INTEGER,

    dayforcall TEXT,

    timeforcall TEXT,

    timezone TEXT

  );
`);

// DEFAULT USERS
const users =
  await pool.query(
    `SELECT * FROM clients`
  );

if(users.rows.length === 0){

  await pool.query(`

    INSERT INTO clients
    (
      username,
      firstname,
      lastname,
      role,
      password
    )

    VALUES

    (
      'user',
      'John',
      'Doe',
      'user',
      '1234'
    ),

    (
      'family',
      'Sarah',
      'Doe',
      'family',
      '1234'
    )

  `);

}

console.log("Database ready.");
```

}

catch(err){

```
console.log(err);
```

}

}

initDB();

// =========================
// PAGE ROUTES
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

app.get('/family',(req,res)=>{

res.sendFile(
path.join(__dirname,'family.html')
);

});

// =========================
// HEADER
// =========================
app.get('/header',(req,res)=>{

res.sendFile(
path.join(__dirname,'header.html')
);

});

// =========================
// AUTH
// =========================
app.get('/auth',(req,res)=>{

res.json(
req.session.user || null
);

});

// =========================
// LOGIN
// =========================
app.post('/login', async(req,res)=>{

try{

```
const {
  username,
  password
} = req.body;

const result = await pool.query(

  `
  SELECT *
  FROM clients
  WHERE username=$1
  AND password=$2
  `,

  [username,password]

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
```

}

catch(err){

```
console.log(err);

res.status(500).json({
  success:false
});
```

}

});

// =========================
// LOGOUT
// =========================
app.get('/logout',(req,res)=>{

req.session.destroy(()=>{

```
res.send("Logged out");
```

});

});

// =========================
// SAVE CHECKIN
// =========================
app.post('/api/checkin', async(req,res)=>{

try{

```
const user = req.session.user;

if(!user){

  return res.json({
    success:false,
    error:"Not logged in"
  });

}

const today =
  new Date().toISOString().split('T')[0];

const {
  mood,
  meds
} = req.body;

const existing = await pool.query(

  `
  SELECT *
  FROM checkins
  WHERE clientid=$1
  AND date=$2
  `,

  [user.id,today]

);

if(existing.rows.length === 0){

  await pool.query(

    `
    INSERT INTO checkins
    (
      clientid,
      date,
      mood,
      meds
    )

    VALUES($1,$2,$3,$4)
    `,

    [
      user.id,
      today,
      mood || null,
      meds || null
    ]

  );

}

else{

  const row =
    existing.rows[0];

  await pool.query(

    `
    UPDATE checkins
    SET mood=$1,
        meds=$2
    WHERE id=$3
    `,

    [

      mood || row.mood,

      meds || row.meds,

      row.id

    ]

  );

}

res.json({
  success:true
});
```

}

catch(err){

```
console.log(err);

res.json({
  success:false,
  error:"Error saving"
});
```

}

});

// =========================
// LOAD TODAY CHECKIN
// =========================
app.get('/api/checkin-today', async(req,res)=>{

try{

```
const user = req.session.user;

if(!user){

  return res.json({
    checkedIn:false
  });

}

const today =
  new Date().toISOString().split('T')[0];

const result = await pool.query(

  `
  SELECT *
  FROM checkins
  WHERE clientid=$1
  AND date=$2
  `,

  [user.id,today]

);

if(result.rows.length === 0){

  return res.json({
    checkedIn:false
  });

}

const row =
  result.rows[0];

res.json({

  checkedIn:true,

  mood:row.mood,

  meds:row.meds

});
```

}

catch(err){

```
console.log(err);

res.json({
  checkedIn:false
});
```

}

});

// =========================
// SAVE ACTIVITIES
// =========================
app.post('/api/activities', async(req,res)=>{

try{

```
const user = req.session.user;

if(!user){

  return res.json({
    success:false
  });

}

const {
  dayForCall,
  timeForCall,
  timezone
} = req.body;

await pool.query(
  `DELETE FROM activities WHERE clientid=$1`,
  [user.id]
);

await pool.query(

  `
  INSERT INTO activities
  (
    clientid,
    dayforcall,
    timeforcall,
    timezone
  )

  VALUES($1,$2,$3,$4)
  `,

  [
    user.id,
    dayForCall,
    timeForCall,
    timezone
  ]

);

res.json({
  success:true
});
```

}

catch(err){

```
console.log(err);

res.json({
  success:false
});
```

}

});

// =========================
// LOAD ACTIVITIES
// =========================
app.get('/api/activities', async(req,res)=>{

try{

```
const user = req.session.user;

if(!user){

  return res.json({});
}

const result = await pool.query(

  `
  SELECT *
  FROM activities
  WHERE clientid=$1
  `,

  [user.id]

);

res.json(
  result.rows[0] || {}
);
```

}

catch(err){

```
console.log(err);

res.json({});
```

}

});

// =========================
// FAMILY DASHBOARD
// =========================
app.get('/family-data', async(req,res)=>{

try{

```
const result = await pool.query(

  `
  SELECT
    c.firstname,
    c.lastname,
    k.date,
    k.mood,
    k.meds

  FROM checkins k

  JOIN clients c
  ON c.id = k.clientid

  ORDER BY k.date DESC
  `

);

res.json({
  checkins:result.rows
});
```

}

catch(err){

```
console.log(err);

res.json({
  checkins:[]
});
```

}

});

// =========================
// TEST
// =========================
app.get('/test',(req,res)=>{

res.send("TEST WORKING");

});

// =========================
// START SERVER
// =========================
const PORT =
process.env.PORT || 3000;

app.listen(PORT,()=>{

console.log(
"Server running on port " + PORT
);

});
