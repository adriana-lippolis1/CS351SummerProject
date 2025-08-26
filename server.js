//-------------------------------------------------------------------------------------------------------
// server.js
// Node.js server using Express, MySQL, MySQL2, bcrypt for password hashing, and express-session for session management
// Ensure all are installed via npm
//
//
// Import necessary modules
//-------------------------------------------------------------------------------------------------------
const express = require('express');
const path = require('path'); // Import the path module
const mysql = require('mysql2');
const app = express();

const bcrypt = require('bcrypt');
const session = require('express-session');
const saltRounds = 10; // Number of salt rounds for bcrypt

const PORT = 3000;

// Add middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from directory
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {secure: false} // Set to true if using HTTPS
}));
//-------------------------------------------------------------------------------------------------------

// Database connection parameters / creation
//-------------------------------------------------------------------------------------------------------
// Create database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'zmelosh',
  password: 'admin',
  database: 'cs351db'
});

// Connect to database
db.connect(err => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database successfully');
});

// Create user table query if it doesn't exist
const createTableQueryUser = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
  )
`;

// Execute the create table query
db.query(createTableQueryUser, (err, res) => {
  if (err) {
    console.error('Error creating table:', err);
    return;
  }
  console.log('Users table created or already exists');
});

// Ensure 'name' column exists in 'users' table
const checkColumnQuery = `
  SHOW COLUMNS FROM users LIKE 'name'
`;

db.query(checkColumnQuery, (err, results) => {
  if (err) {
    console.error('Error checking for name column:', err);
    return;
  }

  if (results.length === 0) {
    // Column does not exist, add it
    const alterTableQuery = `
      ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'Anonymous'
    `;
    db.query(alterTableQuery, (err, res) => {
      if (err) {
        console.error('Error adding name column:', err);
        return;
      }
      console.log('Added name column to users table');
    });
  } else {
    console.log('Name column already exists');
  }
});

// Create user table query if it doesn't exist
const createTableQueryPost = `
  CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date VARCHAR(255) NOT NULL,
    poster VARCHAR(255) NOT NULL,
    likes INT DEFAULT 0
  )
`;

// Execute the create table query for posts
db.query(createTableQueryPost, (err, res) => {
  if (err) {
    console.error('Error creating table:', err);
    return;
  }
  console.log('Posts table created or already exists');
});
//-------------------------------------------------------------------------------------------------------

// API endpoints
//-------------------------------------------------------------------------------------------------------
// API endpoint to check if user is logged in
app.get('/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    res.status(200).json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(401).json({ loggedIn: false });
  }
});

// API endpoint to create a new user
app.post('/create-account', async (req, res) => {
  const { name, username, password, email } = req.body;

  //Check if username or email already exists
  const duplicateCheck = 'SELECT id FROM users WHERE username = ? OR email = ?';
  db.query(duplicateCheck, [username, email], async (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (results.length > 0) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }

    //If all good, create user
    const hPassword = await bcrypt.hash(password, saltRounds); // Hash the password
    const query = 'INSERT INTO users (name, username, password, email) VALUES (?, ?, ?, ?)';
    db.query(query, [name, username, hPassword, email], (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ message: 'User created successfully', id: results.insertId });
    });

  });
});

// API endpoint for user login
app.post('/login', (req, res) => {
  const { username, password} = req.body;
  
  const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error('DB error during login:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid Username' });
    }

    const user = results[0];

    //Hashed password comparison
    const comp = await bcrypt.compare(password, user.password);
    if (!comp) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username };

    res.status(200).json({ message: 'Login successful', username: user.username });
  });
});

// API endpoint for user logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// API endpoints for posts
app.post('/posts', (req, res) => {
  const { subject, content, date } = req.body;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const poster = req.session.user.username;
  const likes = 0;

  const query = 'INSERT INTO posts (subject, content, date, poster, likes) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [subject, content, date, poster, likes], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error creating post' });
    }
    res.status(201).json({ message: 'Post created', postId: results.insertId });
  });
});

// Get all posts
app.get('/posts', (req, res) => {
  const query = 'SELECT * FROM posts ORDER BY id DESC';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching posts' });
    }
    res.status(200).json(results);
  });
});
//-------------------------------------------------------------------------------------------------------

// Serve HTML pages
//-------------------------------------------------------------------------------------------------------
// Serve create account page
app.get('/create-account', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-account.html'));
});

// Serve pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
//-------------------------------------------------------------------------------------------------------

// Start the server
//-------------------------------------------------------------------------------------------------------
//Listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});