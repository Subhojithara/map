const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const bodyParser = require('body-parser');

const server = http.createServer(app);
const io = socketio(server);

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage for users
const users = {};

// Simple admin credentials (For demonstration purposes only. Use environment variables and secure methods in production)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/admin', (req, res) => {
    res.render('admin', { authenticated: false });
});

app.post('/admin', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.render('admin', { authenticated: true, users });
    } else {
        res.render('admin', { authenticated: false, error: 'Invalid credentials' });
    }
});

// API endpoint to get all users (for admin)
app.get('/api/users', (req, res) => {
    res.json(Object.values(users));
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle setting username
    socket.on("set-username", (username) => {
        users[socket.id] = {
            id: socket.id,
            username: username || 'Anonymous',
            currentLocation: null,
            history: []
        };
        io.emit("user-list", Object.values(users));
        io.emit("admin-notification", `${users[socket.id].username} has connected.`);
    });

    // Handle location updates
    socket.on("send-location", (data) => {
        if (users[socket.id]) {
            const { latitude, longitude } = data;
            const timestamp = new Date();

            users[socket.id].currentLocation = { latitude, longitude, timestamp };
            users[socket.id].history.push({ latitude, longitude, timestamp });

            // Limit history to last 100 entries to prevent memory issues
            if (users[socket.id].history.length > 100) {
                users[socket.id].history.shift();
            }

            io.emit("receive-location", { id: socket.id, username: users[socket.id].username, latitude, longitude, timestamp });
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        if (users[socket.id]) {
            io.emit("user-disconnected", socket.id);
            io.emit("admin-notification", `${users[socket.id].username} has disconnected.`);
            delete users[socket.id];
            io.emit("user-list", Object.values(users));
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
