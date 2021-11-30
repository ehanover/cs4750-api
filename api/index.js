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
  res.send('Hello world');
});

app.get('/getShopperData', async (req, res) => { // takes parameter shopper_id
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.query.shopper_id;

    // TODO remove duplicated columns
    const shopperInfo = await pool.query('SELECT * FROM Shopper WHERE id=?', [shopper_id]);
    const likedRocks = await pool.query('SELECT * FROM (Liked_rocks INNER JOIN Rock ON Liked_rocks.rock_id=Rock.id) INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE shopper_id=?', [shopper_id]);
    const cartRocks = await pool.query('SELECT * FROM (Cart_rocks INNER JOIN Rock ON Cart_rocks.rock_id=Rock.id) INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE shopper_id=?', [shopper_id]);
    const paymentOptions = await pool.query('SELECT * FROM Has_payment INNER JOIN Payment_option ON Has_payment.payment_id=Payment_option.id WHERE shopper_id=?', [shopper_id]);

    const results = {
      "shopperInfo": shopperInfo[0],
      "likedRocks": likedRocks,
      "cartRocks": cartRocks,
      "paymentOptions": paymentOptions,
    };
    res.json(results);

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.get('/getStoreData', async (req, res) => { // takes parameter store_id
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const store_id = req.query.store_id;

    // TODO remove duplicated columns
    const storeInfo = await pool.query('SELECT * FROM Store WHERE id=?', [store_id]);

    const results = {
      "storeInfo": storeInfo[0],
    };
    res.json(results);

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
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

app.post('/addToCart', async (req, res) => { //Needs shopper_id and rock_id
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.query.shopper_id;
    const rock_id = req.query.rock_id;

    const stmt = 'INSERT INTO Liked_rocks VALUES (?, ?)';
    await pool.query(stmt, [shopper_id, rock_id]);

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/transaction', async (req, res) => { //shopper id, store id, rock id
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.query.shopper_id;
    const store_id = req.query.store_id;
    const rock_id = req.query.rock_id;

    const rock_info = await pool.query('SELECT type_name, weight, is_owner_store FROM Rock WHERE id=?', [rock_id]);
    const type_name = rock_info[0]['type_name']
    const weight = rock_info[0]['weight']
    const is_owner_store = rock_info[0]['is_owner_store']

    const rock_type_details = await pool.query('SELECT price_per_ounce FROM Rock_type WHERE name=?', [type_name]);
    const price_per_ounce = rock_type_details[0]['price_per_ounce']

    const shopper_info = await pool.query('SELECT * FROM Shopper WHERE id=?', [shopper_id]);
    const shopper_balance = shopper_info[0]['balance']

    const store_info = await pool.query('SELECT * FROM Store WHERE id=?', [store_id]);
    const store_balance = store_info[0]['balance']
    const tax_rate = store_info[0]['tax_rate']

    const discount = await pool.query('SELECT count(*) FROM Discount_shoppers WHERE store_id=? AND shopper_id=?', [store_id, shopper_id]);
    const discount_bool = (discount > 0);

    const rock_val = (weight * price_per_ounce)

    const upOwner = "UPDATE Rock SET owner_id=? WHERE id=?"
    const upBool = "UPDATE Rock SET is_owner_store=? WHERE id=?"
    const upShopper = "UPDATE Shopper SET balance=? WHERE id=?"
    const upStore = "UPDATE Store SET balance=? WHERE id=?"

    const transactionStmt = 'INSERT INTO Transaction VALUES (?, ?, ?, ?, ?)';

    let date_ob = new Date(Date.now();

    if(is_owner_store == 1){
      //DEAL WITH TAX RATE and DISCOUNT STUFF
      if(discount_bool){ //10% DISCOUNT
        rock_val = 0.90*rock_val;
      }
      rock_val = (1+tax_rate)*rock_val;

      await pool.query(upOwner, [shopper_id, rock_id]); //Transfer to shopper
      await pool.query(upShopper, [(shopper_balance-rock_val), shopper_id]); //Decrease shopper balance
      await pool.query(upStore, [(store_balance+rock_val), store_id]); //Increase store balance
      await pool.query(upBool, [0, rock_id]); //No longer in stores possession
      await.pool.query(transactionStmt, [rock_id, shopper_id, store_id, 0, date_ob]) //sold to store is false
    }
    else {
      await pool.query(upOwner, [store_id, rock_id]);
      await pool.query(upShopper, [(shopper_balance+rock_val), shopper_id]); //Increase shopper balance
      await pool.query(upStore, [(store_balance-rock_val), store_id]); //Decrease store balance
      await pool.query(upBool, [1, rock_id]);
      await.pool.query(transactionStmt, [rock_id, shopper_id, store_id, 1, date_ob])
    }


  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
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
