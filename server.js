// =========================
// DEFAULT USERS
// =========================

// CREATE DEFAULT USER ACCOUNT
const userExists = await pool.query(
  "SELECT * FROM clients WHERE LOWER(username)=LOWER($1)",
  ['user']
);

if (userExists.rows.length === 0) {

  await pool.query(
    "INSERT INTO clients " +
    "(username, firstname, lastname, role, password) " +
    "VALUES($1,$2,$3,$4,$5)",
    [
      'user',
      'John',
      'Doe',
      'user',
      '1234'
    ]
  );

  console.log("Created default USER account");

}

// CREATE DEFAULT FAMILY ACCOUNT
const familyExists = await pool.query(
  "SELECT * FROM clients WHERE LOWER(username)=LOWER($1)",
  ['family']
);

if (familyExists.rows.length === 0) {

  await pool.query(
    "INSERT INTO clients " +
    "(username, firstname, lastname, role, password) " +
    "VALUES($1,$2,$3,$4,$5)",
    [
      'family',
      'Sarah',
      'Doe',
      'family',
      '1234'
    ]
  );

  console.log("Created default FAMILY account");

}

// CREATE DEFAULT ADMIN ACCOUNT
const adminExists = await pool.query(
  "SELECT * FROM clients WHERE LOWER(username)=LOWER($1)",
  ['admin']
);

if (adminExists.rows.length === 0) {

  await pool.query(
    "INSERT INTO clients " +
    "(username, firstname, lastname, role, password) " +
    "VALUES($1,$2,$3,$4,$5)",
    [
      'admin',
      'System',
      'Administrator',
      'admin',
      '1234'
    ]
  );

  console.log("Created default ADMIN account");

}