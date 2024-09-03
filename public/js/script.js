const socket = io();

let isSharingLocation = true;
let userLocation = { latitude: 0, longitude: 0 };

// Prompt for username
function promptUsername() {
    let username = prompt("Enter your username:");
    if (!username) {
        username = 'Anonymous';
    }
    socket.emit("set-username", username);
}

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            if (isSharingLocation) {
                socket.emit("send-location", userLocation);
            }
        },
        (error) => {
            console.error(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
        }
    );
}

const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Subhajit"
}).addTo(map);

const markers = {};
const paths = {};

// Listen for location updates
socket.on("receive-location", (data) => {
    const { id, username, latitude, longitude } = data;
    if (id !== socket.id) {
        if (markers[id]) {
            markers[id].setLatLng([latitude, longitude]);
            paths[id].addLatLng([latitude, longitude]);
        } else {
            markers[id] = L.marker([latitude, longitude]).addTo(map).bindPopup(username);
            paths[id] = L.polyline([[latitude, longitude]], { color: getRandomColor() }).addTo(map);
        }
    }
});

// Listen for user disconnections
socket.on("user-disconnected", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    if (paths[id]) {
        map.removeLayer(paths[id]);
        delete paths[id];
    }
    addNotification(`User ${id} has disconnected.`);
});

// Listen for user list updates
socket.on("user-list", (users) => {
    const userList = document.getElementById("user-list");
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        li.addEventListener('click', () => {
            if (markers[user.id]) {
                map.setView(markers[user.id].getLatLng(), 10);
                markers[user.id].openPopup();
            }
        });
        userList.appendChild(li);
    });
});

// Toggle location sharing
function toggleLocationSharing() {
    isSharingLocation = !isSharingLocation;
    const btn = document.getElementById("toggle-share-btn");
    btn.textContent = isSharingLocation ? "Stop Sharing Location" : "Start Sharing Location";
}

// Utility function to generate random colors for paths
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Add notification
function addNotification(message) {
    const notifications = document.getElementById("notifications");
    const notification = document.createElement("div");
    notification.textContent = message;
    notifications.prepend(notification);
    playNotificationSound();
}

// Play notification sound
function playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play();
}

// Clear notifications
function clearNotifications() {
    const notifications = document.getElementById("notifications");
    notifications.innerHTML = '';
}

// Zoom to user's location
function zoomToUser() {
    if (userLocation.latitude && userLocation.longitude) {
        map.setView([userLocation.latitude, userLocation.longitude], 10);
    }
}

// Listen for admin notifications
socket.on("admin-notification", (message) => {
    addNotification(message);
});

// Initialize
promptUsername();
