class Storage {
    constructor() {
        this.USERS_KEY = 'cal_users';
        this.AVAILABILITY_KEY = 'cal_availability';
        this.REQUESTS_KEY = 'cal_requests';
        this.CURRENT_USER_KEY = 'cal_current_user';
    }

    // User Management
    getUsers() {
        return JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
    }

    saveUser(username, password) {
        const users = this.getUsers();
        if (users[username]) return false; // User exists

        users[username] = {
            username,
            password, // In a real app, this should be hashed!
            joined: new Date().toISOString()
        };
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return true;
    }

    login(username, password) {
        const users = this.getUsers();
        const user = users[username];
        if (!user || user.password !== password) return false;

        localStorage.setItem(this.CURRENT_USER_KEY, username);
        return true;
    }

    resetPassword(username, newPassword) {
        const users = this.getUsers();
        if (!users[username]) return false;

        users[username].password = newPassword;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return true;
    }

    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    }

    getCurrentUser() {
        return localStorage.getItem(this.CURRENT_USER_KEY);
    }

    // Availability
    getAvailability(username) {
        const allData = JSON.parse(localStorage.getItem(this.AVAILABILITY_KEY)) || {};
        return allData[username] || [];
    }

    toggleAvailability(username, day, time) {
        const allData = JSON.parse(localStorage.getItem(this.AVAILABILITY_KEY)) || {};
        if (!allData[username]) allData[username] = [];

        const slotId = `${day}-${time}`;
        const index = allData[username].indexOf(slotId);

        if (index === -1) {
            allData[username].push(slotId); // Mark free
        } else {
            allData[username].splice(index, 1); // Mark busy
        }

        localStorage.setItem(this.AVAILABILITY_KEY, JSON.stringify(allData));
        return allData[username];
    }

    // Requests
    sendRequest(fromUser, toUser) {
        const requests = JSON.parse(localStorage.getItem(this.REQUESTS_KEY)) || [];

        // Check if request already exists
        const exists = requests.some(r => r.from === fromUser && r.to === toUser && r.status === 'pending');
        if (exists) return false;

        requests.push({
            id: Date.now(),
            from: fromUser,
            to: toUser,
            status: 'pending',
            timestamp: new Date().toISOString()
        });

        localStorage.setItem(this.REQUESTS_KEY, JSON.stringify(requests));
        return true;
    }

    getRequests(username) {
        const requests = JSON.parse(localStorage.getItem(this.REQUESTS_KEY)) || [];
        return requests.filter(r => r.to === username && r.status === 'pending');
    }
}
