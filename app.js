const express = require("express"); // Using the express framework
ejs = require("ejs");
uuid = require("uuid");
dao = require("./dao.js");
const app = express();
let cookie_parser = require("cookie-parser");
require("dotenv").config(); // Get environment variables from .env file(s)
var sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

bodyParser = require("body-parser");

const DBSOURCE = "usersdb.sqlite";
const auth = require("./middleware");

const port = 3000;
app.use(cookie_parser("1234"));

class Session {
  constructor(Username, expiresAt) {
    this.Username = Username;
    this.expiresAt = expiresAt;
  }

  // we'll use this method later to determine if the session has expired
  isExpired() {
    this.expiresAt < new Date();
  }
}

// this object stores the users sessions. For larger scale applications, you can use a database or cache for this purpose
const sessions = {};

//db assignment or creation
db = dao.database;

app.set("view engine", "ejs");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.static(__dirname + "/views"));

// * R E G I S T E R   N E W   U S E R

app.post("/api/register", async (req, res) => {
  var errors = [];
  try {
    const { Username, Email, Password } = req.body;

    if (!Username) {
      errors.push("Username is missing");
    }
    if (!Email) {
      errors.push("Email is missing");
    }
    if (errors.length) {
      res.status(400).json({ error: errors.join(",") });
      return;
    }
    let userExists = false;

    dao.getMatchingUsernameEmail(Username, Email, (err, user) => {
      console.log(JSON.stringify(user));
      if (user) {
        if (user.Username == Username)
          return res.status(500).send("Username exists!");
        if (user.Email == Email) return res.status(500).send("Email exists!");
      }
      if (err) return res.status(500).send("Server error!" + err.message);

      dao.createUser([Username, Email, Password], (err) => {
        if (err) return res.status(500).send("Server error!" + err.message);
        dao.findOneUserByEmail(Email, (err, user) => {
          if (err) return res.status(500).send("Server error!");
          const session_token = uuid.v4();
          const now = new Date();
          const expiresAt = new Date(+now + 60 * 60 * 24 * 1000);
          const session = new Session(Username, expiresAt);
          sessions[session_token] = session;

          const token = jwt.sign(
            { user_id: user.Id, username: user.Username, Email },
            process.env.TOKEN_KEY,
            {
              expiresIn: "1h", // 60s = 60 seconds - (60m = 60 minutes, 2h = 2 hours, 2d = 2 days)
            }
          );
          user.Token = token;

          res.cookie("session_token", session_token, {
            expires: expiresAt,
          });
          dao.modifyUserByEmail(
            Email,
            "Token",
            session_token,
            (err, modifyuser) => {
              if (err) return res.send("Something went wrong! " + err);
              res.cookie("jwt", token, {
                expires: expiresAt,
                httpOnly: true,
                secure: true,
              });
              return res.send(user).end();
              // res.redirect("/");
            }
          );
          // res.redirect("/");
        });
      });
    });
    return;
    var sql = "SELECT * FROM Users WHERE Email = ?";
    await db.all(sql, Email, (err, result) => {
      if (err) {
        res.status(402).json({ error: err.message });
        return;
      }

      if (result.length === 0) {
        var salt = bcrypt.genSaltSync(10);

        var data = {
          Username: Username,
          Email: Email,
          Password: bcrypt.hashSync(Password, salt),
          Salt: salt,
          DateCreated: Date("now"),
        };

        var sql =
          "INSERT INTO Users (Username, Email, Password, Salt, DateCreated) VALUES (?,?,?,?,?)";
        var params = [
          data.Username,
          data.Email,
          data.Password,
          data.Salt,
          Date("now"),
        ];
        var user = db.run(sql, params, function(err, innerResult) {
          if (err) {
            res.status(400).json({ error: err.message });
            return;
          }
        });
      } else {
        userExists = true;
        // res.status(404).send("User Already Exist. Please Login");
      }
    });

    setTimeout(() => {
      if (!userExists) {
        res.status(201).json("Success");
      } else {
        res.status(201).json("Record already exists. Please login");
      }
    }, 500);
  } catch (err) {
    console.log(err);
  }
});

// * L O G I N

app.get("/", (req, res) => {
  // token = req.body.token || req.query.token || req.headers["jwt"];

  // if (!token) {
  //   return res.status(403).send("A token is required for authentication");
  // }
  // try {
  //   decodedUser = jwt.verify(token, config.TOKEN_KEY);
  // } catch (err) {
  //   return res.status(401).send("Invalid Token");
  // }

  // res.render("home");

  // if this request doesn't have any cookies, that means it isn't
  // authenticated. Return an error code.
  if (!req.cookies) {
    res.status(401).send("no cookies").end();
    return;
  }

  // We can obtain the session token from the requests cookies, which come with every request
  const session_token = req.cookies["session_token"];
  if (!session_token) {
    // If the cookie is not set, return an unauthorized status
    res.status(401).send("no session token"); //.redirect("login");
    return;
  }

  // We then get the session of the user from our session map
  // that we set in the signinHandler
  // userSession = sessions[sessionToken];
  user = {};
  dao.findOneUserBySessionToken(session_token, (err, row) => {
    user = row;
  });
  if (!user) {
    // If the session token is not present in session map, return an unauthorized error
    res.status(401).send("no active session"); //.redirect("login");
    return;
  }
  // if the session has expired, return an unauthorized error, and delete the
  // session from our map
  // if (userSession.isExpired()) {
  // delete sessions[sessionToken];
  // res.send("session expired"); //.redirect("login");
  // return;
  // }

  // If all checks have passed, we can consider the user authenticated and
  // send a welcome message
  res.render("home");
});

app.post("/api/getuser", (req, res) => {
  console.log(JSON.stringify(req.cookies));
  console.log(JSON.stringify(req.headers));

  if (!req.headers) {
    res.status(401).send("no cookies").end();
    return;
  }
  const session_token = req.headers["session_token"];
  if (!session_token) {
    res.status(401).send("no session token"); //.redirect("login");
    return;
  }
  dao.findOneUserBySessionToken(session_token, (err, row) => {
    user = row;
    console.log(row);
  });
  if (!user) {
    res.status(401).send("no active session"); //.redirect("login");
    return;
  }
  res.send(user);
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});
app.post("/api/login", async (req, res) => {
  console.log(req.body);
  const { Email, Password } = req.body;

  dao.findOneUserByEmail(Email, (err, user) => {
    console.log(JSON.stringify(user));
    if (err) return res.status(500).send("Server error!" + err.message);
    if (!user) return res.status(500).send("User doesnt exist!");

    // const result = bcrypt.compareSync(Password, user.Password);
    const result = Password == user.Password;
    if (!result) return res.send("Password not valid!");

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
    user.Token = token;

    res.cookie("session_token", session_token, { expires: expiresAt });
    dao.modifyUserByEmail(Email, "Token", session_token, (err, modifyuser) => {
      if (err) return res.send("Something went wrong! " + err);
      res.cookie("jwt", token, {
        expires: expiresAt,
        httpOnly: true,
        secure: true,
      });
      return res.send(user).end();
      // res.redirect("/");
    });
  });

  return;
  try {
    // Make sure there is an Email and Password in the request
    if (!(Email && Password)) {
      res.status(400).send("All input is required");
    }
    console.log(Email);

    var sql = "SELECT * FROM Users WHERE Email = ?";
    db.all(sql, Email, function(err, rows) {
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

// * T E S T

app.post("/api/test", auth, (req, res) => {
  res.status(200).send("Token Works - Yay!");
});

app.listen(port, () => console.log(`API listening on port ${port}!`));
