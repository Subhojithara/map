const socket = io();

const adminMap = L.map("admin-map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Subhajit"
}).addTo(adminMap);

const adminMarkers = {};
const adminPaths = {};

function refreshUserList() {
    fetch('/api/users')
        .then(response => response.json())
        .then(data => {
            updateUserList(data);
            data.forEach(user => {
                if (user.currentLocation) {
                    const { latitude, longitude } = user.currentLocation;
                    if (!adminMarkers[user.id]) {
                        adminMarkers[user.id] = L.marker([latitude, longitude])
                            .addTo(adminMap)
                            .bindPopup(user.username);
                        adminPaths[user.id] = L.polyline([[latitude, longitude]], { color: getRandomColor() })
                            .addTo(adminMap);
                    } else {
                        adminMarkers[user.id].setLatLng([latitude, longitude]);
                        adminPaths[user.id].addLatLng([latitude, longitude]);
                    }
                }
            });
        })
        .catch(err => console.error(err));
}

function updateUserList(users) {
    const userList = document.getElementById("user-list");
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        li.addEventListener('click', () => {
            showUserDetails(user);
            if (adminMarkers[user.id]) {
                adminMap.setView(adminMarkers[user.id].getLatLng(), 10);
                adminMarkers[user.id].openPopup();
            }
        });
        userList.appendChild(li);
    });
}

function showUserDetails(user) {
    const userDetails = document.getElementById("user-details");
    userDetails.innerHTML = `
        <p>Username: ${user.username}</p>
        <p>ID: ${user.id}</p>
        <p>Current Location: ${user.currentLocation ? `${user.currentLocation.latitude}, ${user.currentLocation.longitude}` : 'N/A'}</p>
        <p>History:</p>
        <ul>
            ${user.history.map(loc => `<li>${new Date(loc.timestamp).toLocaleString()} - (${loc.latitude}, ${loc.longitude})</li>`).join('')}
        </ul>
        <button onclick="disconnectUser('${user.id}')">Disconnect User</button>
    `;
}

function disconnectUser(userId) {
    socket.emit('admin-disconnect-user', userId);
}

function exportUserData() {
    fetch('/api/users')
        .then(response => response.json())
        .then(data => {
            const csvContent = "data:text/csv;charset=utf-8," 
                + data.map(user => 
                    `${user.username},${user.id},${user.currentLocation ? user.currentLocation.latitude : 'N/A'},${user.currentLocation ? user.currentLocation.longitude : 'N/A'}`)
                    .join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "user_data.csv");
            document.body.appendChild(link); 
            link.click();
        });
}

document.getElementById("refresh-users-btn").addEventListener("click", refreshUserList);
document.getElementById("export-data-btn").addEventListener("click", exportUserData);

document.getElementById("search-user").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    const userList = document.getElementById("user-list");
    Array.from(userList.children).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
});

socket.on("receive-location", (data) => {
    const { id, username, latitude, longitude } = data;
    if (adminMarkers[id]) {
        adminMarkers[id].setLatLng([latitude, longitude]);
        adminPaths[id].addLatLng([latitude, longitude]);
    } else {
        adminMarkers[id] = L.marker([latitude, longitude])
            .addTo(adminMap)
            .bindPopup(username);
        adminPaths[id] = L.polyline([[latitude, longitude]], { color: getRandomColor() })
            .addTo(adminMap);
    }
    refreshUserList(); 
});

socket.on("user-disconnected", (id) => {
    if (adminMarkers[id]) {
        adminMap.removeLayer(adminMarkers[id]);
        delete adminMarkers[id];
    }
    if (adminPaths[id]) {
        adminMap.removeLayer(adminPaths[id]);
        delete adminPaths[id];
    }
    refreshUserList(); 
    addNotification(`User ${id} has disconnected.`);
});

socket.on("admin-notification", (message) => {
    addNotification(message);
});

socket.on("geofence-alert", (alert) => {
    addNotification(`Geofence Alert: ${alert.message}`);
});

function addNotification(message) {
    const notificationsContainer = document.getElementById("notifications");
    const notification = document.createElement('p');
    notification.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    notificationsContainer.appendChild(notification);
}

function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

refreshUserList();
