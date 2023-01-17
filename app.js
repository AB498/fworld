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
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

websocketConnectedUsers = {};
iterNum = 0;

io.on("connection", (socket) => {
  console.log("connected: " + socket.id);

  const session_token = socket.handshake.headers["session_token"];
  console.log(": " + session_token);
  if (!session_token) {
    return;
  }

  if (session_token != "guest")
    dao.findOneUserBySessionToken(session_token, (err, row) => {
      user = row;
      console.log(row);
    });
  else {
    user = { Username: "Guest" };
  }
  if (!user) {
    return;
  }
  tmpUser = user;

  websocketConnectedUsers[socket.id] = tmpUser;
  respObj = { user: { Username: "{ Server }" } };
  respObj["message"] = tmpUser.Username + " joined";
  console.log(respObj);
  io.emit("messages", respObj);

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
  socket.on("messages", (msg) => {
    respObj["user"] = websocketConnectedUsers[socket.id];
    respObj["message"] = msg["message"];
    iterNum++;
    console.log("message: " + msg);
    io.emit("messages", respObj);
    dao.addToTable(
      [tmpUser.Username, respObj["message"], new Date().getTime()],
      (err, modifyuser) => {}
    );
  });
  socket.on("ping", (callback) => {
    callback();
  });
});

bodyParser = require("body-parser");

const DBSOURCE = "usersdb.sqlite";
const auth = require("./middleware");
const { addToTable } = require("./dao.js");

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

app.get("/chat", (req, res) => {
  res.render("chat");
});

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
          user.Token = session_token;

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
            }
          );
        });
      });
    });
    return;
  } catch (err) {
    console.log(err);
  }
});

// * L O G I N

app.get("/", (req, res) => {
  if (!req.cookies) {
    res.status(401).send("no cookies").end();
    return;
  }

  const session_token = req.cookies["session_token"];
  if (!session_token) {
    // res.status(401).send("no session token");
    res.redirect("/login");
    return;
  }

  user = {};
  dao.findOneUserBySessionToken(session_token, (err, row) => {
    user = row;
  });
  if (!user) {
    res.status(401).send("no active session");
    return;
  }
  dao.quer("SELECT * FROM GlobalMessages", (rows, err) => {
    dat = rows;
    console.log(dat);
    res.render("home", {
      userData: user.Username == "admainusername" ? dat : [],
    });
  });
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
    res.status(401).send("no session token");
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
    user.Token = session_token;

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

// * T E S T

app.post("/api/test", auth, (req, res) => {
  res.status(200).send("Token Works - Yay!");
});

server.listen(port, () => console.log(`API listening on port ${port}!`));
