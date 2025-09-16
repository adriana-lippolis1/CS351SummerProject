//-------------------------------------------------------------------------------------------------------
// server.js  (Express + MySQL2 + bcrypt + express-session)  — with post edit + audit tags
//-------------------------------------------------------------------------------------------------------
const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;
const saltRounds = 10;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true if HTTPS
}));

// Serve pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

//-------------------------------------------------------------------------------------------------------
// DB connection
//-------------------------------------------------------------------------------------------------------
const config = require('./config');  // <--- new line

const db = mysql.createConnection(config.db);

db.connect(err => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database successfully');
});

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }  // set true if HTTPS
}));


//-------------------------------------------------------------------------------------------------------
// Schema (create if not exists + make sure columns exist)
//-------------------------------------------------------------------------------------------------------
const createUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    admin TINYINT(1) NOT NULL DEFAULT 0
  )
`;
const createPosts = `
  CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date VARCHAR(255) NOT NULL,
    editedAt VARCHAR(255) NULL,
    editedBy VARCHAR(255) NULL,
    poster VARCHAR(255) NOT NULL,
    likes INT DEFAULT 0
  )
`;
const createComments = `
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
const createPostLikes = `
  CREATE TABLE IF NOT EXISTS postLikes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postId INT NOT NULL,
    userId INT NOT NULL,
    FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (postId, userId)
  )
`;
const createCommentLikes = `
  CREATE TABLE IF NOT EXISTS commentLikes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commentId INT NOT NULL,
    userId INT NOT NULL,
    FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (commentId, userId)
  )
`;

db.query(createUsers, (e) => { if (e) console.error(e); else console.log('Users table ready'); });
db.query(createPosts, (e) => { if (e) console.error(e); else console.log('Posts table ready'); });
db.query(createComments, (e) => { if (e) console.error(e); else console.log('Comments table ready'); });
db.query(createPostLikes, (e) => { if (e) console.error(e); else console.log('PostLikes table ready'); });
db.query(createCommentLikes, (e) => { if (e) console.error(e); else console.log('CommentLikes table ready'); });

// Ensure posts has editedAt/editedBy if table existed before
db.query(`SHOW COLUMNS FROM posts LIKE 'editedAt'`, (err, rows) => {
  if (err) return console.error('Error checking editedAt column:', err);
  if (rows.length === 0) {
    db.query(`ALTER TABLE posts ADD COLUMN editedAt VARCHAR(255) NULL AFTER date`, (e2) => {
      if (e2) console.error('Error adding editedAt:', e2); else console.log('Added editedAt to posts');
    });
  }
});
db.query(`SHOW COLUMNS FROM posts LIKE 'editedBy'`, (err, rows) => {
  if (err) return console.error('Error checking editedBy column:', err);
  if (rows.length === 0) {
    db.query(`ALTER TABLE posts ADD COLUMN editedBy VARCHAR(255) NULL AFTER editedAt`, (e2) => {
      if (e2) console.error('Error adding editedBy:', e2); else console.log('Added editedBy to posts');
    });
  }
});

//-------------------------------------------------------------------------------------------------------
// Auth helpers
//-------------------------------------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session?.user?.admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

//-------------------------------------------------------------------------------------------------------
// Auth endpoints
//-------------------------------------------------------------------------------------------------------
app.get('/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ loggedIn: true, user: req.session.user });
  }
  res.status(401).json({ loggedIn: false });
});

app.post('/create-account', async (req, res) => {
  const { name, username, password, email } = req.body;
  const dup = 'SELECT id FROM users WHERE username = ? OR email = ?';
  db.query(dup, [username, email], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length > 0) return res.status(409).json({ error: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, saltRounds);
    const ins = 'INSERT INTO users (name, username, password, email) VALUES (?, ?, ?, ?)';
    db.query(ins, [name, username, hash, email], (e2, result) => {
      if (e2) return res.status(500).json({ error: e2.message });
      res.status(201).json({ message: 'User created successfully', id: result.insertId });
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const q = 'SELECT * FROM users WHERE username = ?';
  db.query(q, [username], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid Username' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, username: user.username, admin: !!user.admin };
    res.status(200).json({ message: 'Login successful', username: user.username, admin: !!user.admin });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

//-------------------------------------------------------------------------------------------------------
// Posts
//-------------------------------------------------------------------------------------------------------
app.post('/posts', requireAuth, (req, res) => {
  const { subject, content, date } = req.body;
  const poster = req.session.user.username;

  // Adriana Added this 4:32pm on 9/15
  if (subject.length > 255) {
    return res.status(400).json({ error: 'Subject too long (max 255 characters)' });
  }

  const q = 'INSERT INTO posts (subject, content, date, poster, likes) VALUES (?, ?, ?, ?, 0)';
  db.query(q, [subject, content, date, poster], (e, result) => {
    if (e) return res.status(500).json({ error: 'Database error creating post' });
    res.status(201).json({ message: 'Post created', postId: result.insertId });
  });
});

// EDIT post (poster OR admin) — sets editedAt, and editedBy if admin
app.put('/posts/:id', requireAuth, (req, res) => {
  const postId = req.params.id;
  const { subject, content } = req.body;
  const { username, admin } = req.session.user;


  // allow edit if admin or poster
  const select = 'SELECT poster FROM posts WHERE id = ?';
  db.query(select, [postId], (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error (select)' });
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const isOwner = rows[0].poster === username;
    if (!admin && !isOwner) return res.status(403).json({ error: 'Not allowed' });

    const editedAt = new Date().toLocaleString();
    const editedBy = admin ? username : null;

    const upd = 'UPDATE posts SET subject = ?, content = ?, editedAt = ?, editedBy = ? WHERE id = ?';
    db.query(upd, [subject, content, editedAt, editedBy, postId], (e2) => {
      if (e2) return res.status(500).json({ error: 'DB error (update)' });
      res.json({ message: 'Post updated', editedAt, editedBy });
    });
  });
});

app.get('/posts', (req, res) => {
  db.query('SELECT * FROM posts ORDER BY id DESC', (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Delete post: poster OR admin
app.delete('/posts/:id', requireAuth, (req, res) => {
  const postId = req.params.id;
  const { username, admin } = req.session.user;
  const q = admin ? 'DELETE FROM posts WHERE id = ?' : 'DELETE FROM posts WHERE id = ? AND poster = ?';
  const params = admin ? [postId] : [postId, username];
  db.query(q, params, (e, result) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (result.affectedRows === 0) return res.status(403).json({ error: 'Not allowed' });
    res.json({ message: 'Post deleted' });
  });
});

// Like post: toggle by user
app.post('/posts/:id/like', requireAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.id;

  const insert = 'INSERT INTO postLikes (postId, userId) VALUES (?, ?)';
  db.query(insert, [postId, userId], (e) => {
    if (!e) {
      return db.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId], (e2) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        res.json({ liked: true });
      });
    }
    db.query('DELETE FROM postLikes WHERE postId = ? AND userId = ?', [postId, userId], (e3) => {
      if (e3) return res.status(500).json({ error: 'DB error' });
      db.query('UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [postId], (e4) => {
        if (e4) return res.status(500).json({ error: 'DB error' });
        res.json({ liked: false });
      });
    });
  });
});

//-------------------------------------------------------------------------------------------------------
// Comments (unchanged except likes fix you already added on client)
//-------------------------------------------------------------------------------------------------------
app.get('/posts/:postId/comments', (req, res) => {
  db.query('SELECT * FROM comments WHERE postId = ? ORDER BY id ASC', [req.params.postId], (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

app.post('/posts/:postId/comments', requireAuth, (req, res) => {
  const { content, date } = req.body;
  const commenter = req.session.user.username;
  const q = 'INSERT INTO comments (postId, commenter, content, date, likes) VALUES (?, ?, ?, ?, 0)';
  db.query(q, [req.params.postId, commenter, content, date], (e, result) => {
    if (e) return res.status(500).json({ error: 'DB error creating comment' });
    res.status(201).json({ message: 'Comment created', commentId: result.insertId });
  });
});

app.delete('/posts/:postId/comments/:commentId', requireAuth, (req, res) => {
  const { postId, commentId } = req.params;
  const { username, admin } = req.session.user;

  const q = admin
    ? 'DELETE FROM comments WHERE id = ? AND postId = ?'
    : 'DELETE FROM comments WHERE id = ? AND postId = ? AND commenter = ?';

  const params = admin ? [commentId, postId] : [commentId, postId, username];

  db.query(q, params, (e, result) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (result.affectedRows === 0) return res.status(403).json({ error: 'Not allowed' });
    res.json({ message: 'Comment deleted' });
  });
});

app.post('/posts/:postId/comments/:commentId/like', requireAuth, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.session.user.id;

  const ins = 'INSERT INTO commentLikes (commentId, userId) VALUES (?, ?)';
  db.query(ins, [commentId, userId], (e) => {
    if (!e) {
      return db.query('UPDATE comments SET likes = likes + 1 WHERE id = ?', [commentId], (e2) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        res.json({ liked: true });
      });
    }
    db.query('DELETE FROM commentLikes WHERE commentId = ? AND userId = ?', [commentId, userId], (e3) => {
      if (e3) return res.status(500).json({ error: 'DB error' });
      db.query('UPDATE comments SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [commentId], (e4) => {
        if (e4) return res.status(500).json({ error: 'DB error' });
        res.json({ liked: false });
      });
    });
  });
});

//-------------------------------------------------------------------------------------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
