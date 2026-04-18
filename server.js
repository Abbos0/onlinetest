const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    ism TEXT,
    familiya TEXT,
    telefon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    savol TEXT,
    javob_a TEXT,
    javob_b TEXT,
    javob_c TEXT,
    javob_d TEXT,
    togri_javob TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    score INTEGER,
    total INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Test vaqti sozlamalari
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.get("SELECT * FROM admins WHERE login = ?", ['admin'], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO admins (login, password) VALUES (?, ?)", ['admin', hash]);
    }
  });

  db.get("SELECT COUNT(*) as count FROM questions", (err, row) => {
    if (row.count === 0) {
      const defaultQuestions = [
        ['JavaScript nima?', 'Dasturlash tili', 'Markup tili', 'Style tili', 'Database', 'A'],
        ['HTML nima?', 'Dasturlash tili', 'Markup tili', 'Style tili', 'Database', 'B'],
        ['CSS nima?', 'Dasturlash tili', 'Markup tili', 'Style tili', 'Database', 'C'],
        ['Node.js nima?', 'Framework', 'Runtime environment', 'Library', 'Database', 'B'],
        ['React nima?', 'Framework', 'Library', 'Language', 'Database', 'B']
      ];
      const stmt = db.prepare("INSERT INTO questions (savol, javob_a, javob_b, javob_c, javob_d, togri_javob) VALUES (?, ?, ?, ?, ?, ?)");
      defaultQuestions.forEach(q => stmt.run(q));
      stmt.finalize();
    }
  });
});

const activeUsers = new Map();

app.post('/api/register', (req, res) => {
  const { ism, familiya, telefon } = req.body;
  const id = uuidv4();
  
  db.run("INSERT INTO users (id, ism, familiya, telefon) VALUES (?, ?, ?, ?)", 
    [id, ism, familiya, telefon], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, ism, familiya, telefon });
    }
  );
});

app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body;
  
  db.get("SELECT * FROM admins WHERE login = ?", [login], (err, row) => {
    if (err || !row) {
      return res.status(401).json({ error: 'Login yoki parol xato' });
    }
    
    if (bcrypt.compareSync(password, row.password)) {
      res.json({ success: true, login: row.login });
    } else {
      res.status(401).json({ error: 'Login yoki parol xato' });
    }
  });
});

app.get('/api/questions', (req, res) => {
  db.all("SELECT * FROM questions", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Test vaqtini olish (daqiqa)
app.get('/api/test-duration', (req, res) => {
  db.get("SELECT value FROM settings WHERE key = 'test_duration'", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Default 20 daqiqa
    const duration = row ? parseInt(row.value) : 20;
    res.json({ duration: duration });
  });
});

// Test vaqtini saqlash (admin uchun)
app.post('/api/test-duration', (req, res) => {
  const { duration } = req.body;
  
  // Validatsiya: eng kami 1 daqiqa
  if (!duration || duration < 1) {
    return res.status(400).json({ error: 'Vaqt kamida 1 daqiqa bo\'lishi kerak' });
  }
  
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", 
    ['test_duration', duration.toString()],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, duration: duration });
    }
  );
});

app.post('/api/results', (req, res) => {
  const { user_id, score, total } = req.body;
  
  db.run("INSERT INTO results (user_id, score, total) VALUES (?, ?, ?)", 
    [user_id, score, total],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

app.get('/api/users', (req, res) => {
  db.all("SELECT id, ism, familiya, telefon FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/results/:userId', (req, res) => {
  const userId = req.params.userId;
  db.get("SELECT score, total, completed_at FROM results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1", [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || null);
  });
});

function parseQuestions(text) {
  console.log('Parse qilinmoqda...');
  console.log('Matn uzunligi:', text.length);
  
  // Windows va Mac yangi qator belgilarini standardga o'tkazish
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Yopishib qolgan qatorlarni ajratish: "1.Savol?++Javob##Javob" -> "1.Savol?\n++Javob\n##Javob"
  text = text.replace(/(\d+[\.\)]\s*[^\n]+?)((?=\+\+)|(?=##))/g, '$1\n$2');
  text = text.replace(/(\+\+[^\n]+?)((?=\+\+)|(?=##)|(?=\d+\.))/g, '$1\n$2');
  text = text.replace(/(##[^\n]+?)((?=\+\+)|(?=##)|(?=\d+\.))/g, '$1\n$2');
  
  console.log('Tozalangan matn:\n' + text.substring(0, 500));
  
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  console.log('Jami qatorlar:', lines.length);
  console.log('Barcha qatorlar:', JSON.stringify(lines.slice(0, 20)));
  
  let currentQuestion = null;
  let answers = [];
  
  for (const line of lines) {
    // Savol: 1.Savol? yoki 1) Savol?
    const questionMatch = line.match(/^\d+[\.\)]\s*(.+)/);
    if (questionMatch) {
      // Oldingi savolni saqlash
      if (currentQuestion && answers.length >= 4) {
        questions.push({
          savol: currentQuestion,
          javob_a: answers[0]?.text || '',
          javob_b: answers[1]?.text || '',
          javob_c: answers[2]?.text || '',
          javob_d: answers[3]?.text || '',
          togri_javob: answers.find(a => a.correct)?.letter || 'A'
        });
      }
      currentQuestion = questionMatch[1].trim();
      answers = [];
    } else if (line.startsWith('##') || line.startsWith('++')) {
      const text = line.substring(2).trim();
      const correct = line.startsWith('##');
      const letter = ['A', 'B', 'C', 'D'][answers.length] || 'X';
      answers.push({ text, correct, letter });
    }
  }
  
  // Oxirgi savolni saqlash
  if (currentQuestion && answers.length >= 4) {
    questions.push({
      savol: currentQuestion,
      javob_a: answers[0]?.text || '',
      javob_b: answers[1]?.text || '',
      javob_c: answers[2]?.text || '',
      javob_d: answers[3]?.text || '',
      togri_javob: answers.find(a => a.correct)?.letter || 'A'
    });
  }
  
  console.log('Parse qilingan savollar soni:', questions.length);
  
  return questions;
}

app.post('/api/upload-questions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fayl yuklanmadi' });
    }
    
    console.log('Fayl yuklandi:', req.file.originalname, req.file.mimetype);
    
    const result = await mammoth.extractRawText({ path: req.file.path });
    const text = result.value;
    
    console.log('Matn uzunligi:', text.length);
    console.log('Birinchi 300 ta belgi:', JSON.stringify(text.substring(0, 300)));
    
    fs.unlinkSync(req.file.path);
    
    const questions = parseQuestions(text);
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'Savollar topilmadi. Format: 1.Savol? ##Javob ++Javob. Matn uzunligi: ' + text.length });
    }
    
    const stmt = db.prepare("INSERT INTO questions (savol, javob_a, javob_b, javob_c, javob_d, togri_javob) VALUES (?, ?, ?, ?, ?, ?)");
    let added = 0;
    for (const q of questions) {
      stmt.run(q.savol, q.javob_a, q.javob_b, q.javob_c, q.javob_d, q.togri_javob);
      added++;
    }
    stmt.finalize();
    
    res.json({ success: true, added, questions });
  } catch (err) {
    console.error('Xatolik:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM questions WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-test', (userData) => {
    activeUsers.set(socket.id, userData);
    socket.broadcast.emit('user-joined', { socketId: socket.id, ...userData });
  });

  socket.on('video-offer', (data) => {
    socket.to(data.target).emit('video-offer', {
      sender: socket.id,
      sdp: data.sdp
    });
  });

  socket.on('video-answer', (data) => {
    socket.to(data.target).emit('video-answer', {
      sender: socket.id,
      sdp: data.sdp
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      sender: socket.id,
      candidate: data.candidate
    });
  });

  socket.on('admin-join', () => {
    const users = Array.from(activeUsers.entries()).map(([socketId, userData]) => ({
      socketId,
      ...userData
    }));
    socket.emit('active-users', users);
  });
  
  socket.on('request-video', (data) => {
    socket.to(data.target).emit('admin-connecting', { adminSocketId: socket.id });
  });

  // Test natijasini admin ga jo'natish
  socket.on('test-completed', (data) => {
    console.log('Test yakunlandi:', data);
    // Adminlarga natijani jo'natish
    socket.broadcast.emit('user-test-completed', data);
  });

  socket.on('disconnect', () => {
    const userData = activeUsers.get(socket.id);
    if (userData) {
      activeUsers.delete(socket.id);
      socket.broadcast.emit('user-left', { socketId: socket.id, ...userData });
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
