var dao = {
  createUsersTable: () => {
    const sqlQuery =
      "CREATE TABLE IF NOT EXISTS users (id integer PRIMARY KEY,name text,email text UNIQUE,password text)";

    return database.run(sqlQuery);
  },

  findUserByEmail: (email, cb) => {
    return database.get(
      `SELECT * FROM users WHERE email = ?`,
      [email],
      (err, row) => {
        cb(err, row);
      }
    );
  },

  createUser: (user, cb) => {
    return database.run(
      "INSERT INTO users (name, email, password) VALUES (?,?,?)",
      user,
      (err) => {
        cb(err);
      }
    );
  },
};
module.exports = dao;
