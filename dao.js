const DBSOURCE = "usersdb.sqlite";
var bcrypt = require("bcryptjs");
var sqlite3 = require("sqlite3").verbose();

var dao = {
  database: new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message);
      throw err;
    } else {
      var salt = bcrypt.genSaltSync(10);

      db.run(
        `CREATE TABLE Users (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            Username text, 
            Email text, 
            Password text,             
            Salt text,    
            Token text,
            DateLoggedIn DATE,
            DateCreated DATE,
            VerifiedEmail INTEGER
            )`,
        (err) => {
          if (err) {
            // Table already created
          } else {
            // Table just created, creating some rows
            var insert =
              "INSERT INTO Users (Username, Email, Password, Salt, DateCreated) VALUES (?,?,?,?,?)";
            db.run(insert, [
              "user1",
              "user1@example.com",
              bcrypt.hashSync("user1", salt),
              salt,
              Date("now"),
            ]);
            db.run(insert, [
              "user2",
              "user2@example.com",
              bcrypt.hashSync("user2", salt),
              salt,
              Date("now"),
            ]);
            db.run(insert, [
              "user3",
              "user3@example.com",
              bcrypt.hashSync("user3", salt),
              salt,
              Date("now"),
            ]);
            db.run(insert, [
              "user4",
              "user4@example.com",
              bcrypt.hashSync("user4", salt),
              salt,
              Date("now"),
            ]);
          }
        }
      );
    }
  }),
  createUsersTable: () => {
    const sqlQuery =
      "CREATE TABLE IF NOT EXISTS Users (id integer PRIMARY KEY,name text,email text UNIQUE,password text)";

    return dao.database.run(sqlQuery);
  },

  findOneUserByEmail: (email, cb) => {
    return dao.database.get(
      `SELECT * FROM users WHERE Email = ?`,
      [email],
      (err, row) => {
        cb(err, row);
      }
    );
  },
  getMatchingUsernameEmail: (uname, email, cb) => {
    return dao.database.get(
      `SELECT * FROM users WHERE Email = ? OR Username = ?`,
      [email, uname],
      (err, row) => {
        cb(err, row);
      }
    );
  },
  findOneUserBySessionToken: (tk, cb) => {
    return dao.database.get(
      `SELECT * FROM users WHERE Token = ?`,
      [tk],
      (err, row) => {
        cb(err, row);
      }
    );
  },
  modifyUserByUsername: (username, key, value, cb) => {
    return dao.database.get(
      `UPDATE Users
      SET ? = ? 
      WHERE Username = ?;`,
      [key, value, username],
      (err, row) => {
        cb(err, row);
      }
    );
  },

  modifyUserByEmail: (email, column, value, cb) => {
    sqlq = `UPDATE Users
      SET '${column}' = '${value}' 
      WHERE Email = '${email}';`;
    return dao.database.get(sqlq, [], (err, row) => {
      cb(err ? err.message + " " + sqlq : "", row);
    });
  },

  quer: (cb) => {
    return dao.database.get(sqlq, [], (err, row) => {
      cb(err ? err.message + " " + sqlq : "", row);
    });
  },

  createUser: (user, cb) => {
    return dao.database.run(
      "INSERT INTO users (Username, Email, Password) VALUES (?,?,?)",
      user,
      (err) => {
        cb(err);
      }
    );
  },
};

module.exports = dao;
