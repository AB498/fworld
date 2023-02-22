// auth.js

function login(Email, Password) {
  // authentication logic goes here
  return new Promise((resolve, reject) => {
    dao.findOneUserByEmail(Email, (err, user) => {
      console.log(JSON.stringify(user));
      if (err) reject(err);
      if (!user) reject(err);

      // const result = bcrypt.compareSync(Password, user.Password);
      const result = Password == user.Password;
      if (!result) reject(err);

      // * CREATE JWT TOKEN
      const session_token = uuid.v4();
      const now = new Date();
      const expiresAt = new Date(+now + 60 * 60 * 24 * 1000);
      const session = new Session(user.Username, expiresAt);
      sessions[session_token] = session;

      const token = jwt.sign(
        { user_id: user.Id, username: user.Username, Email },
        process.env.TOKEN_KEY,
        {
          expiresIn: "1h", // 60s = 60 seconds - (60m = 60 minutes, 2h = 2 hours, 2d = 2 days)
        }
      );
      user.Token = session_token;

      dao.modifyUserByEmail(
        Email,
        "Token",
        session_token,
        (err, modifyuser) => {
          if (err) return { error: 3 };
          return {
            error: null,
            user: user,
            jwt: token,
            expiresAt: expiresAt,
            session_token: session_token,
          };
          // res.redirect("/");
        }
      );
    });

    return;
    try {
      // Make sure there is an Email and Password in the request
      if (!(Email && Password)) {
        res.status(400).send("All input is required");
      }
      console.log(Email);

      var sql = "SELECT * FROM Users WHERE Email = ?";
      db.all(sql, Email, function (err, rows) {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }

        var PHash = bcrypt.hashSync(Password, user[0].Salt);

        if (PHash === user[0].Password) {
          // * CREATE JWT TOKEN
          const token = jwt.sign(
            { user_id: user[0].Id, username: user[0].Username, Email },
            process.env.TOKEN_KEY,
            {
              expiresIn: "1h", // 60s = 60 seconds - (60m = 60 minutes, 2h = 2 hours, 2d = 2 days)
            }
          );

          user[0].Token = token;
        } else {
          return res.status(400).send("No Match");
        }

        return res.status(200).send(user);
      });
    } catch (err) {
      console.log(err);
    }
  });
}

module.exports = {
  login,
};
