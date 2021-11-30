'use strict';
// Modified from https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#node.js

process.env.DB_USER='user1';
process.env.DB_PASS='user1';
// process.env.DB_USER='root';
// process.env.DB_PASS='rockdbpassword';

process.env.DB_NAME='rock_database2';
process.env.DB_HOST='34.85.177.29:3306';
// process.env.DB_SOCKET_PATH='/cloudsql';
// process.env.INSTANCE_CONNECTION_NAME='rockapp-330402:us-east4:rock-db';


const express = require('express');
const mysql = require('promise-mysql');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
// app.set('view engine', 'pug');
// app.enable('trust proxy');

// Automatically parse request body as form data.
// app.use(express.urlencoded({extended: false}));
// This middleware is available in Express v4.16.0 onwards
// app.use(express.json());

// Set Content-Type for all responses for these routes.
// app.use((req, res, next) => {
//   res.set('Content-Type', 'text/html');
//   next();
// });


// I never got this method working
const createTcpPool = async config => {
  const dbSocketAddr = process.env.DB_HOST.split(':');
  console.log(`createTcpPool() with dbSocketAddr values=${dbSocketAddr}`);
  // Extract host and port from socket address

  // Establish a connection to the database
  return mysql.createPool({
    user: process.env.DB_USER, // e.g. 'my-db-user'
    password: process.env.DB_PASS, // e.g. 'my-db-password'
    database: process.env.DB_NAME, // e.g. 'my-database'
    host: dbSocketAddr[0], // e.g. '127.0.0.1'
    port: dbSocketAddr[1], // e.g. '3306'
    // ... Specify additional properties here.
    ...config,
  });
};

const createUnixSocketPool = async config => {
  const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';
  console.log(`createUnixSocketPool() with socketPath=${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}`);

  // Establish a connection to the database
  return mysql.createPool({
    user: process.env.DB_USER, // e.g. 'my-db-user'
    password: process.env.DB_PASS, // e.g. 'my-db-password'
    database: process.env.DB_NAME, // e.g. 'my-database'
    // If connecting via unix domain socket, specify the path
    socketPath: `${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}`,
    // Specify additional properties here.
    ...config,
  });
};

const createPool = async () => {
  console.log("createPool()");
  const config = {
    // 'connectionLimit' is the maximum number of connections the pool is allowed
    // to keep at once.
    connectionLimit: 5,

    // 'connectTimeout' is the maximum number of milliseconds before a timeout
    // occurs during the initial connection to the database.
    connectTimeout: 10000, // 10 seconds
    // 'acquireTimeout' is the maximum number of milliseconds to wait when
    // checking out a connection from the pool before a timeout error occurs.
    acquireTimeout: 10000, // 10 seconds
    // 'waitForConnections' determines the pool's action when no connections are
    // free. If true, the request will queued and a connection will be presented
    // when ready. If false, the pool will call back with an error.
    waitForConnections: true, // Default: true
    // 'queueLimit' is the maximum number of requests for connections the pool
    // will queue at once before returning an error. If 0, there is no limit.
    queueLimit: 0, // Default: 0

    // The mysql module automatically uses exponential delays between failed
    // connection attempts.
  };
  if (process.env.DB_HOST) {
    if (process.env.DB_ROOT_CERT) {
      return createTcpPoolSslCerts(config);
    } else {
      return createTcpPool(config);
    }
  } else {
    return createUnixSocketPool(config);
  }
};

const ensureSchema = async pool => {
  // Wait for tables to be created (if they don't already exist).
//   await pool.query(
//     `CREATE TABLE IF NOT EXISTS votes
//       ( vote_id SERIAL NOT NULL, time_cast timestamp NOT NULL,
//       candidate CHAR(6) NOT NULL, PRIMARY KEY (vote_id) );`
//   );
//   console.log("Ensured that table 'votes' exists");
    console.log("Schema and table checks bypassed");
};

const createPoolAndEnsureSchema = async () =>
  await createPool()
    .then(async pool => {
      await ensureSchema(pool);
      return pool;
    })
    .catch(err => {
      throw err;
    });



// Set up a variable to hold our connection pool. It would be safe to
// initialize this right away, but we defer its instantiation to ease
// testing different configurations.
let pool;

app.use(async (req, res, next) => {
  if (pool) {
    return next();
  }
  try {
    pool = await createPoolAndEnsureSchema();
    next();
  } catch (err) {
    return next(err);
  }
});


app.get('/', async (req, res) => {
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const stmt = 'SELECT * FROM Rock WHERE id<?';
    const query = pool.query(stmt, ['5']);
    console.log('prepared the query');

    const queryResults = await query;
    console.log('Query results:');
    console.log(queryResults);
    res.status(200).send('Success');

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.get('/getUserData', async (req, res) => {
  res.status(500).send('TODO');
});

app.get('/getStoreData', async (req, res) => {
  res.status(500).send('TODO');
});


/*
app.post('/', async (req, res) => {
  const {team} = req.body;
  const timestamp = new Date();

  if (!team || (team !== 'TABS' && team !== 'SPACES')) {
    return res.status(400).send('Invalid team specified.').end();
  }

  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const stmt = 'INSERT INTO votes (time_cast, candidate) VALUES (?, ?)';
    // Pool.query automatically checks out, uses, and releases a connection
    // back into the pool, ensuring it is always returned successfully.
    await pool.query(stmt, [timestamp, team]);
  } catch (err) {
    // If something goes wrong, handle the error in this section. This might
    // involve retrying or adjusting parameters depending on the situation.
    logger.error(err);
    return res
      .status(500)
      .send(
        'Unable to successfully cast vote! Please check the application logs for more details.'
      )
      .end();
  }

  res.status(200).send(`Successfully voted for ${team} at ${timestamp}`).end();
});
*/

app.post('/login', async (req, res) => {
  res.status(500).send('TODO');
});

app.post('/purchase', async (req, res) => {
  res.status(500).send('TODO');
});

app.post('/addToCart', async (req, res) => {
  res.status(500).send('TODO');
});

app.post('/sell', async (req, res) => {
  res.status(500).send('TODO');
});


const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

process.on('unhandledRejection', err => {
  console.error(err);
  throw err;
});

module.exports = server;
