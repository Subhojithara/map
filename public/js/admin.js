const socket = io();

            // Initialize map for admin
            const adminMap = L.map("admin-map").setView([0, 0], 2);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "Subhajit"
            }).addTo(adminMap);

            const adminMarkers = {};
            const adminPaths = {};

            // Function to refresh the user list and update the map
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

            // Function to update the user list in the UI
            function updateUserList(users) {
                const userList = document.getElementById("user-list");
                userList.innerHTML = '';
                users.forEach(user => {
                    const li = document.createElement('li');
                    li.textContent = user.username;
                    li.addEventListener('click', () => {
                        if (adminMarkers[user.id]) {
                            adminMap.setView(adminMarkers[user.id].getLatLng(), 10);
                            adminMarkers[user.id].openPopup();
                        }
                    });
                    userList.appendChild(li);
                });
            }

            // Add event listener to refresh button
            document.getElementById("refresh-users-btn").addEventListener("click", refreshUserList);

            // Listen for location updates
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
                refreshUserList(); // Refresh user list on location update
            });

            // Listen for user disconnections
            socket.on("user-disconnected", (id) => {
                if (adminMarkers[id]) {
                    adminMap.removeLayer(adminMarkers[id]);
                    delete adminMarkers[id];
                }
                if (adminPaths[id]) {
                    adminMap.removeLayer(adminPaths[id]);
                    delete adminPaths[id];
                }
                refreshUserList(); // Refresh user list on disconnection
                addNotification(`User ${id} has disconnected.`);
            });

            // Listen for admin notifications
            socket.on("admin-notification", (message) => {
                addNotification(message);
            });

            // Utility function to generate random colors for paths
            function getRandomColor() {
                return '#' + Math.floor(Math.random() * 16777215).toString(16);
            }

            // Utility function to add notifications to the admin panel
            function addNotification(message) {
                const notificationsContainer = document.getElementById("notifications");
                const notification = document.createElement('p');
                notification.textContent = message;
                notificationsContainer.appendChild(notification);
            }

            // Initial load
            refreshUserList();