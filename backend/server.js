const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Replace with your frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

let recordings = {};

// Load existing recordings from JSON file if it exists
if (fs.existsSync('recordings.json')) {
  const data = fs.readFileSync('recordings.json', 'utf8');
  recordings = JSON.parse(data);
}

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

app.post('/start-session', (req, res) => {
  const sessionId = Date.now().toString();
  recordings[sessionId] = [];
  const sessionDir = path.join(__dirname, 'uploads', sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  res.json({ sessionId });
});

app.get('/recordings', (req, res) => {
  res.json(recordings);
});

app.get('/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(__dirname, 'uploads', sessionId);
  
  if (fs.existsSync(sessionDir)) {
    const files = fs.readdirSync(sessionDir).sort((a, b) => parseInt(a) - parseInt(b));
    
    res.writeHead(200, {
      'Content-Type': 'video/webm',
      'Transfer-Encoding': 'chunked'
    });

    let fileIndex = 0;
    const streamNextChunk = () => {
      if (fileIndex < files.length) {
        const chunkPath = path.join(sessionDir, files[fileIndex]);
        const chunk = fs.readFileSync(chunkPath);
        res.write(chunk);
        fileIndex++;
        setTimeout(streamNextChunk, 1000); // Adjust timing as needed
      } else {
        res.end();
      }
    };

    streamNextChunk();
  } else {
    res.status(404).send('Session not found');
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('stream', ({ sessionId, chunk }) => {
    if (!recordings[sessionId]) {
      recordings[sessionId] = [];
    }
    const chunkId = recordings[sessionId].length;
    recordings[sessionId].push(chunkId);
    const chunkPath = path.join(__dirname, 'uploads', sessionId, `${chunkId}.webm`);
    fs.writeFile(chunkPath, chunk, (err) => {
      if (err) console.error('Error saving chunk:', err);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Save recordings to JSON file periodically
setInterval(() => {
  fs.writeFile('recordings.json', JSON.stringify(recordings), (err) => {
    if (err) console.error('Error saving recordings.json:', err);
  });
}, 5000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));