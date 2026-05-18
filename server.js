// =========================
// SAVE ACTIVITIES
// =========================
app.post('/api/activities', async (req, res) => {

  try {

    console.log("ACTIVITIES BODY:", req.body);

    const user = req.session.user;

    console.log("SESSION USER:", user);

    if (!user) {

      return res.status(401).json({
        success: false,
        error: "No session user"
      });

    }

    const dayForCall = req.body.dayForCall;
    const timeForCall = req.body.timeForCall;
    const timezone = req.body.timezone;

    console.log("SAVING ACTIVITIES:", {
      clientid: user.id,
      dayForCall,
      timeForCall,
      timezone
    });

    // REMOVE OLD RECORDS
    await pool.query(
      "DELETE FROM activities WHERE clientid=$1",
      [user.id]
    );

    // INSERT NEW RECORD
    await pool.query(
      "INSERT INTO activities " +
      "(clientid, dayforcall, timeforcall, timezone) " +
      "VALUES($1,$2,$3,$4)",
      [
        user.id,
        dayForCall || null,
        timeForCall || null,
        timezone || null
      ]
    );

    console.log("ACTIVITIES SAVE SUCCESS");

    res.json({
      success: true
    });

  }

  catch (err) {

    console.log("ACTIVITIES SAVE ERROR:");
    console.log(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});