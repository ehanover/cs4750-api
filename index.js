'use strict';
// Modified from https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#node.js
/*
alter table Shopper modify column balance float;

*/

const express = require('express');
const mysql = require('promise-mysql');
const passwordHash = require('password-hash'); // could also use bcrypt instead (https://www.npmjs.com/package/bcrypt)
const cors = require('cors');
require('dotenv').config()

const app = express();
app.use(cors());
app.use(express.json());


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
  // console.log("Schema and table checks bypassed");

  // Wait for tables to be created (if they don't already exist).
  // await pool.query(
  //   `CREATE TABLE IF NOT EXISTS votes
  //     ( vote_id SERIAL NOT NULL, time_cast timestamp NOT NULL,
  //     candidate CHAR(6) NOT NULL, PRIMARY KEY (vote_id) );`
  // );
  // console.log("Ensured that table 'votes' exists");
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
  console.log('/');
  res.send('Hello world');
});

app.get('/getShopperData', async (req, res) => { // takes parameter shopper_id
  console.log('/getShopperData');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.query.shopper_id;

    const shopperInfo = await pool.query('SELECT id, name, balance FROM Shopper WHERE id=?', [shopper_id]);
    const likedRocks = await pool.query(
      `SELECT shopper_id, rock_id, owner_id, description, weight, origin, type_name, is_owner_store, rarity, price_per_ounce
      FROM (Liked_rocks INNER JOIN Rock ON Liked_rocks.rock_id=Rock.id) INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE shopper_id=?`, [shopper_id]);
    const cartRocks = await pool.query(
      `SELECT shopper_id, rock_id, owner_id, description, weight, origin, type_name, is_owner_store, rarity, price_per_ounce
      FROM (Cart_rocks INNER JOIN Rock ON Cart_rocks.rock_id=Rock.id) INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE shopper_id=?`, [shopper_id]);
      const ownedRocks = await pool.query(
        `SELECT id AS rock_id, owner_id, description, weight, origin, type_name, is_owner_store, rarity, price_per_ounce
        FROM Rock INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE is_owner_store=0 AND owner_id=?`, [shopper_id]);
    const paymentOptions = await pool.query(
      `SELECT shopper_id, payment_id, type, card_name, card_number
      FROM Has_payment INNER JOIN Payment_option ON Has_payment.payment_id=Payment_option.id WHERE shopper_id=?`, [shopper_id]);

    const results = {
      "shopperInfo": shopperInfo[0],
      "likedRocks": likedRocks,
      "cartRocks": cartRocks,
      "ownedRocks": ownedRocks,
      "paymentOptions": paymentOptions,
    };
    res.json(results);

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.get('/getStoreData', async (req, res) => { // takes parameter store_id
  console.log('/getStoreData');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const store_id = req.query.store_id;

    const storeInfo = await pool.query('SELECT * FROM Store WHERE id=?', [store_id]);
    const discountShoppers = await pool.query(`
      SELECT store_id, shopper_id, name, balance
      FROM Discount_shoppers INNER JOIN Shopper ON Discount_shoppers.shopper_id=Shopper.id WHERE store_id=?`, [store_id]);

    const results = {
      "storeInfo": storeInfo[0],
      "discountShoppers": discountShoppers,
    };
    res.json(results);

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});



app.post('/login', async (req, res) => { // takes parameters name and password (in plaintext)
  console.log('/login');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const name = req.body.name;
    const passwordPlain = req.body.password;

    const queryResult = await pool.query('SELECT id, password_hash FROM Shopper WHERE name=?', [name]);
    const hash = queryResult[0]['password_hash'];

    // console.log("comparing to hash", hash);
    if(passwordHash.verify(passwordPlain, hash)) {
      // successful login
      res.json({'shopper_id': queryResult[0]['id']});
    } else {
      // failed login
      res.status(400).send('Login denied');
    }
  } catch (err) {
    console.log(err);
    res.status(400).send('Login denied').end(); // this will happen if the name entered isn't in the database
  }
});

app.post('/addToCart', async (req, res) => { // Needs shopper_id and rock_id
  console.log('/addToCart');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.body.shopper_id;
    const rock_id = req.body.rock_id;

    const alreadyCartResult = await pool.query('SELECT count(*) FROM Cart_rocks WHERE shopper_id=? AND rock_id=?', [shopper_id, rock_id]);
    if(alreadyCartResult[0]['count(*)'] > 0) {
      res.status(500).send('That rock is already in that shopper\'s cart');
    } else {
      const stmt = 'INSERT INTO Cart_rocks VALUES (?, ?)';
      await pool.query(stmt, [shopper_id, rock_id]);
      res.status(200).send('Successfully added rock to cart');
    }

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/removeFromCart', async (req, res) => { // Needs shopper_id and rock_id
  console.log('/removeFromCart');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.body.shopper_id;
    const rock_id = req.body.rock_id;

    const stmt = 'DELETE FROM Cart_rocks WHERE shopper_id=? AND rock_id=?';
    await pool.query(stmt, [shopper_id, rock_id]);
    res.status(200).send('Successfully removed rock from cart');

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/transaction', async (req, res) => { // Needs recipient_id and rock_id          shopper_id, store_id, rock_id
  console.log('/transaction');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const recipient_id = req.body.recipient_id;
    const rock_id = req.body.rock_id;
    let shopper_id = 0; //Temp Val
    let store_id = 0; //Temp Val

    const rock_info = await pool.query('SELECT owner_id, type_name, weight, is_owner_store FROM Rock WHERE id=?', [rock_id]);
    const type_name = rock_info[0]['type_name']
    const weight = rock_info[0]['weight']
    const is_owner_store = rock_info[0]['is_owner_store']

    if(is_owner_store == 1){
      store_id = rock_info[0]['owner_id']
      shopper_id = recipient_id;
    }
    else{
      shopper_id = rock_info[0]['owner_id']
      store_id = recipient_id;
    }

    const rock_type_details = await pool.query('SELECT price_per_ounce FROM Rock_type WHERE name=?', [type_name]);
    const price_per_ounce = rock_type_details[0]['price_per_ounce']

    const shopper_info = await pool.query('SELECT * FROM Shopper WHERE id=?', [shopper_id]);
    const shopper_balance = shopper_info[0]['balance']

    const store_info = await pool.query('SELECT * FROM Store WHERE id=?', [store_id]);
    const store_balance = store_info[0]['balance']
    const tax_rate = store_info[0]['tax_rate']

    const discount = await pool.query('SELECT count(*) FROM Discount_shoppers WHERE store_id=? AND shopper_id=?', [store_id, shopper_id]);
    const discount_bool = (discount > 0);

    let rock_val = (weight * price_per_ounce)

    const upOwner = "UPDATE Rock SET owner_id=? WHERE id=?"
    const upBool = "UPDATE Rock SET is_owner_store=? WHERE id=?"
    const upShopper = "UPDATE Shopper SET balance=? WHERE id=?"
    const upStore = "UPDATE Store SET balance=? WHERE id=?"

    const transactionStmt = 'INSERT INTO Transaction VALUES (?, ?, ?, NOW(), ?)';

    console.log("  fetched all data");

    if(is_owner_store == 1){
      console.log("  owner is store");
      //DEAL WITH TAX RATE and DISCOUNT STUFF
      if(discount_bool){ //10% DISCOUNT
        console.log("  shopper has discount");
        rock_val = 0.90*rock_val;
      }
      rock_val = (1+tax_rate)*rock_val;

      if(shopper_balance < rock_val){
        console.log("  shopper can't afford rock");
        res.status(500).send('Balance Not Enough').end();
        return;
      }

      await pool.query(upOwner, [shopper_id, rock_id]); //Transfer to shopper
      await pool.query(upShopper, [(shopper_balance-rock_val), shopper_id]); //Decrease shopper balance
      await pool.query(upStore, [(store_balance+rock_val), store_id]); //Increase store balance
      await pool.query(upBool, [0, rock_id]); //No longer in stores possession
      await pool.query(transactionStmt, [rock_id, shopper_id, store_id, 0]); //sold to store is false
    } else { // rock is being sold to the store
      console.log("  owner is not store");
      await pool.query(upOwner, [store_id, rock_id]);
      await pool.query(upShopper, [(shopper_balance+rock_val), shopper_id]); //Increase shopper balance
      await pool.query(upStore, [(store_balance-rock_val), store_id]); //Decrease store balance
      await pool.query(upBool, [1, rock_id]);
      await pool.query(transactionStmt, [rock_id, shopper_id, store_id, 1])
    }

    await pool.query("DELETE FROM Cart_rocks WHERE rock_id=?", [rock_id]); //Remove from Everyones Cart
    res.status(200).send('Successfully processed transaction');

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/likeRock', async (req, res) => { // Needs shopper_id and rock_id
  console.log('/likeRock');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.body.shopper_id;
    const rock_id = req.body.rock_id;

    const alreadyLikedResult = await pool.query('SELECT count(*) FROM Liked_rocks WHERE shopper_id=? AND rock_id=?', [shopper_id, rock_id]);
    if(alreadyLikedResult[0]['count(*)'] > 0) {
      res.status(500).send('Rock is already liked by that shopper');
    } else {
      await pool.query('INSERT INTO Liked_rocks VALUES (?, ?)', [shopper_id, rock_id]);
      res.status(200).send('Successfully liked the rock');
    }

  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/unlikeRock', async (req, res) => { // Needs shopper_id and rock_id
  console.log('/unlikeRock');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const shopper_id = req.body.shopper_id;
    const rock_id = req.body.rock_id;

    await pool.query('DELETE FROM Liked_rocks WHERE shopper_id=? AND rock_id=?', [shopper_id, rock_id]);
    res.status(200).send('Unliked the rock');
  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
});

app.post('/deleteRock', async (req, res) => { // Needs rock_id (shopper_id is implied from the db)
  console.log('/deleteRock');
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    const rock_id = req.body.rock_id;

    const rockInfo = await pool.query('SELECT owner_id, weight, price_per_ounce, is_owner_store FROM Rock INNER JOIN Rock_type ON Rock.type_name=Rock_type.name WHERE id=?', [rock_id]);

    if(rockInfo[0]['is_owner_store'] == 1) {
      res.status(500).send('This rock cannot be deleted because it is currently owned by the store');
    } else if(rockInfo[0]['owner_id'] == null) {
      res.status(500).send('This rock cannot be deleted because it has already been deleted');
    } else {
      const shopper_id = rockInfo[0]['owner_id'];

      const rockPrice = rockInfo[0]['price_per_ounce'] * rockInfo[0]['weight'];
      const oldShopperBalance = (await pool.query('SELECT balance FROM Shopper WHERE id=?', [shopper_id]))[0]['balance']
      await pool.query('UPDATE Shopper SET balance=? WHERE id=?', [oldShopperBalance + rockPrice, shopper_id]);

      await pool.query('DELETE FROM Cart_rocks WHERE rock_id=?', [rock_id]);
      await pool.query('DELETE FROM Liked_rocks WHERE rock_id=?', [rock_id]);

      // await pool.query('DELETE FROM Rock WHERE id=?', [rock_id]); // this doesn't work because of the foreign key constraint on transactions
      await pool.query('UPDATE Rock SET owner_id=NULL, is_owner_store=0 WHERE id=?', [rock_id]); // instead set owner to null and remove from stores

      res.status(200).send('Successfully deleted rock');
    }


  } catch (err) {
    console.log(err);
    res.status(500).send('Unable to load page').end();
  }
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
