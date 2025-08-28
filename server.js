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
const { create } = require('domain');
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
    console.error('Error creating posts table:', err);
    return;
  }
  console.log('Posts table created or already exists');
});

// Create comments table query if it doesn't exist
// Foreign key references posts(id) to link comments to posts, when a post is deleted its comments are also deleted
const createTableQueryComment = `
  CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postId INT NOT NULL,
    commenter VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date VARCHAR(255) NOT NULL,
    likes INT DEFAULT 0,
    FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
  )
`;

// Execute the create table query for comments
db.query(createTableQueryComment, (err, res) => {
  if (err) {
    console.error('Error creating comments table:', err);
    return;
  }
  console.log('Comments table created or already exists');  
});

// Create likes table query if it doesn't exist
// To track which users have liked which posts, preventing multiple likes from the same user
const createTableQueryLikePost = `
  CREATE TABLE IF NOT EXISTS postLikes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postId INT NOT NULL,
    userId INT NOT NULL,
    FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (postId, userId) -- Ensure a user can like a post only once
)
`;

// Execute the create table query for likes
db.query(createTableQueryLikePost, (err, res) => {
  if (err) {
    console.error('Error creating likes table:', err);
    return;
  }
  console.log('Likes table created or already exists');
});

// Create comment likes table query if it doesn't exist
const createTableQueryLikeComment = `
  CREATE TABLE IF NOT EXISTS commentLikes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commentId INT NOT NULL,
    userId INT NOT NULL,
    FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (commentId, userId) -- Ensure a user can like a post only once
)
`;

// Execute the create table query for likes
db.query(createTableQueryLikeComment, (err, res) => {
  if (err) {
    console.error('Error creating comment likes table:', err); 
    return;
  }
  console.log('Comment Likes table created or already exists');
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

// Like a post
// Push like to database
app.post('/posts/:id/like', (req, res) => {
  const postId = req.params.id;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const username = req.session.user.username;

  db.query('SELECT id FROM users WHERE username = ?', [username], (err, userResults) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching user' });
    }
    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResults[0].id;


    // Check if user has already liked the post
    const checkLikeQuery = 'SELECT * FROM postLikes WHERE postId = ? AND userId = ?';
    db.query(checkLikeQuery, [postId, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error checking like' });
      }
      if (results.length > 0) {
        // Remove like if already liked
        const deleteLikeQuery = 'DELETE FROM postLikes WHERE postId = ? AND userId = ?';
        db.query(deleteLikeQuery, [postId, userId], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database error removing like' });
          }
          // Decrement like count in posts table
          const updatePostQuery = 'UPDATE posts SET likes = likes - 1 WHERE id = ? AND likes > 0';
          db.query(updatePostQuery, [postId], (err, results) => {
            if (err) {
              return res.status(500).json({ error: 'Database error updating post likes' });
            }
            return res.status(200).json({ message: 'Like removed' });
          });
        });
        return;
      }

      // Insert like record
      const insertLikeQuery = 'INSERT INTO postLikes (postId, userId) VALUES (?, ?)';
      db.query(insertLikeQuery, [postId, userId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error inserting like' });
        }

        // Increment like count in posts table
        const updatePostQuery = 'UPDATE posts SET likes = likes + 1 WHERE id = ?';
        db.query(updatePostQuery, [postId], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database error updating post likes' });
          }
          res.status(200).json({ message: 'Post liked' });
        });
      });
    });
  });
});

// Delete a post
app.delete('/posts/:id', (req, res) => {
  const postId = req.params.id;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Ensure the user deleting the post is the original poster
  const checkQuery = 'SELECT poster FROM posts WHERE id = ?';
  db.query(checkQuery, [postId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error checking post' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (results[0].poster !== req.session.user.username) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own posts' });
    }

    const deleteQuery = 'DELETE FROM posts WHERE id = ?';
    db.query(deleteQuery, [postId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error deleting post' });
      }
      res.status(200).json({ message: 'Post deleted' });
    });
  });
});

// API endpoints for comments
// Add a comment to a post
app.post('/posts/:id/comments', (req, res) => {
  const postId = req.params.id;
  const { content, date } = req.body;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const commenter = req.session.user.username;

  const query = 'INSERT INTO comments (postId, commenter, content, date) VALUES (?, ?, ?, ?)';
  db.query(query, [postId, commenter, content, date], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error creating comment' });
    }
    res.status(201).json({ message: 'Comment added', commentId: results.insertId });
  });
});

// Get comments for a post
app.get('/posts/:id/comments', (req, res) => {
  const postId = req.params.id;
  const query = 'SELECT * FROM comments WHERE postId = ? ORDER BY date DESC';
  db.query(query, [postId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching comments' });
    }
    res.status(200).json(results);
  });
});

// Delete a comment
app.delete('/posts/:postId/comments/:commentId', (req, res) => {
  const { postId, commentId } = req.params;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const username = req.session.user.username;
  // Ensure the user deleting the comment is the original commenter
  const checkQuery = 'SELECT commenter FROM comments WHERE id = ? AND postId = ?';
  db.query(checkQuery, [commentId, postId], (err, results) => {
    if (err) { 
      return res.status(500).json({ error: 'Database error checking comment' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (results[0].commenter !== username) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own comments' });
    }
    const deleteQuery = 'DELETE FROM comments WHERE id = ? AND postId = ?';
    db.query(deleteQuery, [commentId, postId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error deleting comment' });
      }
      res.status(200).json({ message: 'Comment deleted' });
    });
  });
});


// API endpoint to like a comment
// Remove like if already liked, otherwise add like
app.post('/posts/:postId/comments/:commentId/like', (req, res) => {
  const { postId, commentId } = req.params;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const username = req.session.user.username;
  db.query('SELECT id FROM users WHERE username = ?', [username], (err, userResults) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching user' });
    }
    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResults[0].id;

    // Check if user has already liked the comment
    const checkLikeQuery = 'SELECT * FROM commentLikes WHERE commentId = ? AND userId = ?';
    db.query(checkLikeQuery, [commentId, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error checking like' });
      }
      if (results.length > 0) {
        // Remove like if already liked
        const deleteLikeQuery = 'DELETE FROM commentLikes WHERE commentId = ? AND userId = ?';
        db.query(deleteLikeQuery, [commentId, userId], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database error removing like' });
          }
          // Decrement like count in comments table
          const updateCommentQuery = 'UPDATE comments SET likes = likes - 1 WHERE id = ? AND likes > 0';
          db.query(updateCommentQuery, [commentId], (err, results) => {
            if (err) {
              return res.status(500).json({ error: 'Database error updating comment likes' });
            }
            return res.status(200).json({ message: 'Like removed' });
          });
        });
        return;
      }

      // Insert like record
      const insertLikeQuery = 'INSERT INTO commentLikes (commentId, userId) VALUES (?, ?)';
      db.query(insertLikeQuery, [commentId, userId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error inserting like' });
        }

        // Increment like count in comments table
        const updateCommentQuery = 'UPDATE comments SET likes = likes + 1 WHERE id = ?';
        db.query(updateCommentQuery, [commentId], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database error updating comment likes' });
          }
          res.status(200).json({ message: 'Comment liked' });
        });
      });
    });
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