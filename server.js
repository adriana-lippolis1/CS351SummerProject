const express = require('express');
const path = require('path'); // Import the path module
const mysql = require('mysql2');
const app = express();

const PORT = 3000;

// Add middleware to parse JSON bodies
app.use(express.json());

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

// Example: Create a table
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
  )
`;

db.query(createTableQuery, (err, results) => {
  if (err) {
    console.error('Error creating table:', err);
    return;
  }
  console.log('Users table created or already exists');
});

// Example: API endpoint to create a new user
app.post('/create-account', (req, res) => {
  const { username, password, email } = req.body;
  
  const query = 'INSERT INTO users (username, password, email) VALUES (?, ?, ?)';
  db.query(query, [username, password, email], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({ message: 'User created successfully', id: results.insertId });
  });
});

// Example: API endpoint to create a new user
app.post('/login', (req, res) => {
  const { username, password} = req.body;
  
const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('DB error during login:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid Username' });
    }

    const user = results[0];

    // Compare plaintext passwords, use hashing later
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ message: 'Login successful', username: user.username });
  });
});

// Example: API endpoint to get all users
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

// app.get('/create-account', (req, res) => {
//     res.sendFile(path.join(__dirname, 'create-account.html'));
// });

//Listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});