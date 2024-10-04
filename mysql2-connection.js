const mysql = require('mysql2');

// Create a connection
const connection = mysql.createConnection({
  host: 'localhost', // Replace with your MySQL host (usually 'localhost')
  user: 'root', // Replace with your MySQL username
  password: '', // Replace with your MySQL password
  database: 'asg-omni-channel-assessment' // Replace with your database name
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the MySQL database');
});

function runQuery(query) {
  return new Promise((resolve) => {
    connection.query(query, function (err, result) {
        resolve(result);
    });
  });	
}

function insertTo(table, params) {
  let keys = Object.keys(params);
  let query_string = `INSERT INTO ${table} (`;
  let value_string = 'VALUES (';
  let values = [];

  for (let i = 0; i < keys.length; i++) {
    value_string += '?';
    query_string += keys[i];
    values.push(params[keys[i]]);
    if (i < keys.length - 1) {
      value_string += ', ';
      query_string += ', ';
    } else {
      value_string += ')';
      query_string += ') ' + value_string;
    }
  }
  
  let query = mysql.format(query_string, values);
  return runQuery(query);
}

async function getAllOtherUsers(id) {
  let query = mysql.format(`
    SELECT users.id, users.username
    FROM users
    WHERE users.id != ?`, [id]
  );
  return runQuery(query);
}

function validateSignin(username, password) {
  let query = mysql.format(`
    SELECT id, username
    FROM users
    WHERE users.username = ? AND users.password = ? LIMIT 1;`, [username, password]
  );
  return runQuery(query);
}

function submitChat(params) {
  ['from_user_id', 'to_user_id'].forEach((param) => {
    if (params[param] == null) return;
  });
  if (params['message'] == null && params['attachment'] == null) return;

  return insertTo('chat', params);
}

function getAttachment(params) {
  ['table', 'id', 'user_id'].forEach((param) => {
    if (params[param] == null) return;
  });
  let query = mysql.format(`
    SELECT filename, attachment, mimetype
    FROM ${params.table}
    WHERE id = ? AND (from_user_id = ? OR to_user_id = ?) LIMIT 1;`,
    [params.id, params.user_id, params.user_id]
  );
  return runQuery(query);
}

async function getFullLog(params) {
  let query = mysql.format(`
    SELECT id, from_user_id, to_user_id, message, filename, mimetype
    FROM ${params.table}
    WHERE from_user_id IN (?, ?) AND to_user_id IN (?, ?)
    ORDER BY created_at`,
    [params.user_id, params.recepient_id, params.user_id, params.recepient_id]
  );
  let messages = await runQuery(query);

  query = mysql.format(`
    SELECT id, username
    FROM users
    WHERE id IN (?, ?)`,
    [params.user_id, params.recepient_id]
  );
  let users = await runQuery(query);
  let new_users = {};
  users.forEach((obj) => {
    new_users[obj.id] = obj.username;
  });

  for (let i = 0; i < messages.length; i++) {
    messages[i]['from_username'] = new_users[messages[i]['from_user_id']];
    messages[i]['to_username'] = new_users[messages[i]['to_user_id']];
  }

  return messages;
}

async function getGmailCredentials(id) {
  let query = mysql.format(`
    SELECT gmail, app_pass
    FROM users
    WHERE id = ?
    LIMIT 1`,
    [id]
  );
  let results = await runQuery(query);

  return (results.length > 0) ? results[0] : false;
}

function storeMessage(params) {
  return insertTo('table', params);
}

function close() {
  // Close the connection when done
  connection.end((err) => {
    if (err) {
      console.error('Error closing the connection:', err);
      return;
    }
    console.log('Connection closed');
  });
}

module.exports = {
  runQuery,
  getAllOtherUsers,
  validateSignin,
  submitChat,
  close,
  getAttachment,
  getFullLog,
  getGmailCredentials,
  storeMessage
};