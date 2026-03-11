const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const path = require('path');

const User = require('./models/User');
const Event = require('./models/Event');
const Request = require('./models/Request');
const Log = require('./models/Log');
const Feedback = require('./models/Feedback');

const app = express();
const PORT = 3000;
const BCRYPT_ROUNDS = 10;
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@12345';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/social-calendar', {})
    .then(() => {
        console.log('MongoDB Connected');
        initAdminUser();
    })
    .catch(err => console.error(err));

// ─── Email Setup ──────────────────────────────────────────────────────────────
let transporter = null;
async function setupMailer() {
    try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email', port: 587, secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass }
        });
        console.log('📧 Ethereal email ready:', testAccount.user);
        console.log('📬 View sent emails at: https://ethereal.email/messages');
    } catch (err) {
        console.error('Mailer setup failed:', err.message);
    }
}
setupMailer();

async function sendMail(to, subject, html) {
    if (!transporter) return null;
    const info = await transporter.sendMail({
        from: '"CalConnect" <noreply@calconnect.app>', to, subject, html
    });
    const preview = nodemailer.getTestMessageUrl(info);
    console.log(`📧 Email → ${to} | Preview: ${preview}`);
    return preview;
}

function styledEmailWrapper(title, body) {
    return `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#6d28d9;">${title}</h2>${body}
        <hr style="border-color:#e5e7eb;margin-top:24px;">
        <p style="color:#9ca3af;font-size:0.75rem;">CalConnect — Affordable services, connected community.</p>
    </div>`;
}

// ─── Admin Bootstrap ──────────────────────────────────────────────────────────
async function initAdminUser() {
    try {
        const existing = await User.findOne({ username: ADMIN_USERNAME });
        if (!existing) {
            const hashed = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
            await new User({
                username: ADMIN_USERNAME, password: hashed,
                email: 'admin@calconnect.app',
                isVerified: true, isAdmin: true, profileComplete: true
            }).save();
            console.log(`✅ Admin user created — login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
        }
    } catch (err) {
        console.error('Admin init error:', err.message);
    }
}

// ─── Action Logger ────────────────────────────────────────────────────────────
async function logAction(action, actor, target = '', detail = '') {
    try { await new Log({ action, actor, target, detail }).save(); } catch (_) { }
}

// ─── Admin Middleware ─────────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
    const username = req.headers['x-username'];
    if (!username) return res.status(401).json({ error: 'Authentication required' });
    const user = await User.findOne({ username, isAdmin: true });
    if (!user) return res.status(403).json({ error: 'Admin access required' });
    req.adminUser = user;
    next();
}

// ─── HTML Page Helpers ────────────────────────────────────────────────────────
function htmlPage(title, body) {
    return `<!DOCTYPE html><html><head><title>${title} — CalConnect</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Outfit',sans-serif;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#1e1b4b;padding:2.5rem;border-radius:1.25rem;border:1px solid #4338ca;text-align:center;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.4);}
h2{color:#a78bfa;font-size:1.6rem;margin-bottom:0.75rem;} p{color:#c4b5fd;line-height:1.6;margin-bottom:1rem;}
input{width:100%;padding:12px;border:2px solid #4338ca;border-radius:10px;font-size:1rem;background:#0f0f1a;color:#fff;margin-bottom:1rem;font-family:inherit;}
input:focus{border-color:#a78bfa;outline:none;}
button{width:100%;padding:12px;background:#6d28d9;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;}
button:hover{background:#5b21b6;} a{color:#a78bfa;} .err{color:#f87171;margin-bottom:1rem;font-size:0.9rem;}
.ok{color:#34d399;margin-bottom:1rem;font-size:0.9rem;}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!username || !password || !email)
            return res.status(400).json({ error: 'Username, password, and email are required' });

        if (await User.findOne({ username }))
            return res.status(400).json({ error: 'Username already taken' });
        if (await User.findOne({ email }))
            return res.status(400).json({ error: 'Email already registered' });

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        await new User({
            username, password: hashed, email,
            isVerified: false, verificationToken,
            verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }).save();

        const verifyUrl = `http://localhost:${PORT}/api/auth/verify-email?token=${verificationToken}`;
        const previewUrl = await sendMail(email, 'Activate your CalConnect account',
            styledEmailWrapper('Welcome to CalConnect!',
                `<p>Hi <strong>${username}</strong>, click below to activate your account:</p>
                <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Activate My Account</a>
                <p style="color:#6b7280;font-size:0.85rem;margin-top:1rem;">Link expires in 24 hours.</p>`));

        await logAction('REGISTER', username, username, `Email: ${email}`);
        res.json({ success: true, message: 'Account created. Check your email to verify.', previewUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Verify email
app.get('/api/auth/verify-email', async (req, res) => {
    try {
        const user = await User.findOne({ verificationToken: req.query.token });
        if (!user || user.verificationExpiry < new Date())
            return res.send(htmlPage('Verification Failed',
                '<div style="font-size:3rem">❌</div><h2>Verification Failed</h2><p>Invalid or expired link.</p><a href="/">← Back to CalConnect</a>'));

        user.isVerified = true; user.verificationToken = '';
        await user.save();
        await logAction('VERIFY_EMAIL', user.username);
        res.send(htmlPage('Email Verified',
            `<div style="font-size:3rem">✅</div><h2>Email Verified!</h2><p>Your account <strong>${user.username}</strong> is now active. You can log in.</p><a href="/">Go to CalConnect →</a>`));
    } catch (err) { res.status(500).send(htmlPage('Error', '<h2>Server Error</h2>')); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        if (!user.isVerified) return res.status(403).json({ error: 'Account not yet verified. Check your email.', unverified: true });
        if (user.isDisabled) return res.status(403).json({ error: 'This account has been disabled. Contact an administrator.' });

        await logAction('LOGIN', username);
        res.json({
            success: true,
            user: {
                _id: user._id, username: user.username, email: user.email,
                bio: user.bio, zipCode: user.zipCode, serviceType: user.serviceType,
                profileComplete: user.profileComplete, joined: user.joined,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'No account with that username found' });
        if (!user.email) return res.status(400).json({ error: 'No email address on file for this account' });

        const token = crypto.randomBytes(32).toString('hex');
        user.resetToken = token;
        user.resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        const resetUrl = `http://localhost:${PORT}/api/auth/reset-password?token=${token}`;
        const previewUrl = await sendMail(user.email, 'Reset your CalConnect password',
            styledEmailWrapper('Password Reset Request',
                `<p>Hi <strong>${username}</strong>, click below to reset your password. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset My Password</a>
                <p style="color:#6b7280;font-size:0.85rem;margin-top:1rem;">If you didn't request this, ignore this email.</p>`));

        await logAction('FORGOT_PASSWORD', username);
        res.json({ success: true, message: 'Password reset email sent.', previewUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset password form (GET — serves HTML)
app.get('/api/auth/reset-password', async (req, res) => {
    const { token } = req.query;
    const user = token ? await User.findOne({ resetToken: token }) : null;
    if (!user || user.resetExpiry < new Date()) {
        return res.send(htmlPage('Link Expired',
            '<div style="font-size:3rem">⏰</div><h2>Link Expired</h2><p>This reset link is invalid or has expired. Please request a new one.</p><a href="/">← Back</a>'));
    }
    res.send(htmlPage('Reset Password',
        `<div style="font-size:2.5rem;margin-bottom:0.5rem">🔑</div>
        <h2>Choose a New Password</h2>
        <p>For account: <strong>${user.username}</strong></p>
        <div id="msg"></div>
        <form onsubmit="submitReset(event)">
            <input type="password" id="pw" placeholder="New password" required minlength="8">
            <input type="password" id="pw2" placeholder="Confirm password" required>
            <button type="submit">Reset Password</button>
        </form>
        <script>
        async function submitReset(e) {
            e.preventDefault();
            const pw = document.getElementById('pw').value;
            const pw2 = document.getElementById('pw2').value;
            const msg = document.getElementById('msg');
            if (pw !== pw2) { msg.innerHTML='<p class="err">Passwords do not match.</p>'; return; }
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;
            if (!regex.test(pw)) { msg.innerHTML='<p class="err">Password must be 8+ chars with uppercase, lowercase, digit, and special character.</p>'; return; }
            const res = await fetch('/api/auth/reset-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: '${token}', password: pw }) });
            const data = await res.json();
            if (data.success) { msg.innerHTML='<p class="ok">✅ Password reset! <a href=\\'/\\'>Log in now →</a></p>'; }
            else { msg.innerHTML='<p class="err">'+data.error+'</p>'; }
        }
        </script>`));
});

// Reset password submit (POST)
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await User.findOne({ resetToken: token });
        if (!user || user.resetExpiry < new Date())
            return res.status(400).json({ error: 'Invalid or expired reset token' });

        user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        user.resetToken = ''; user.resetExpiry = null;
        await user.save();
        await logAction('PASSWORD_RESET', user.username);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Forgot Username
app.post('/api/auth/forgot-username', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'No account associated with that email' });

        const previewUrl = await sendMail(email, 'Your CalConnect username',
            styledEmailWrapper('Username Reminder',
                `<p>Hi there! Your CalConnect username is:</p>
                <p style="font-size:1.5rem;font-weight:700;color:#6d28d9;letter-spacing:1px;">${user.username}</p>
                <p><a href="http://localhost:${PORT}/" style="color:#6d28d9;">Log in to CalConnect →</a></p>`));

        res.json({ success: true, message: 'Username sent to your email.', previewUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({ isVerified: true, isAdmin: false, isDisabled: false }, 'username joined bio zipCode serviceType');
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:username/profile', async (req, res) => {
    try {
        const { bio, zipCode, serviceType } = req.body;
        if (bio && bio.length > 250) return res.status(400).json({ error: 'Bio must be 250 characters or less' });
        if (zipCode && !/^\d{5}$/.test(zipCode)) return res.status(400).json({ error: 'ZIP code must be 5 digits' });

        const user = await User.findOneAndUpdate(
            { username: req.params.username },
            { bio: bio || '', zipCode: zipCode || '', serviceType: serviceType || '', profileComplete: true },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user: { username: user.username, bio: user.bio, zipCode: user.zipCode, serviceType: user.serviceType, profileComplete: user.profileComplete } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AVAILABILITY ROUTES ──────────────────────────────────────────────────────
app.get('/api/availability/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const events = await Event.find({ participants: req.params.username, status: 'confirmed' });
        const bookedSlots = events.map(e => `${e.day}-${e.time}`);
        const prices = {};
        if (user.slotPrices) user.slotPrices.forEach((v, k) => { prices[k] = v; });

        res.json({ availability: user.availability, bookedSlots, busySlots: user.busySlots || [], slotPrices: prices });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/availability/toggle', async (req, res) => {
    try {
        const { username, day, time, price } = req.body;
        const slot = `${day}-${time}`;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const booked = await Event.findOne({ participants: username, day, time, status: 'confirmed' });
        if (booked) return res.status(400).json({ error: 'Slot is booked and cannot be toggled' });

        const isFree = user.availability.includes(slot);
        const isBusy = (user.busySlots || []).includes(slot);

        if (!isFree && !isBusy) {
            user.availability.push(slot);
            if (price !== undefined && price !== null && price !== '') {
                if (!user.slotPrices) user.slotPrices = new Map();
                user.slotPrices.set(slot, parseFloat(price));
            }
        } else if (isFree) {
            user.availability.splice(user.availability.indexOf(slot), 1);
            if (user.slotPrices) user.slotPrices.delete(slot);
            if (!user.busySlots) user.busySlots = [];
            user.busySlots.push(slot);
        } else {
            user.busySlots.splice(user.busySlots.indexOf(slot), 1);
        }

        user.markModified('slotPrices');
        await user.save();
        const prices = {};
        if (user.slotPrices) user.slotPrices.forEach((v, k) => { prices[k] = v; });
        res.json({ availability: user.availability, busySlots: user.busySlots || [], slotPrices: prices });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/availability/set-price', async (req, res) => {
    try {
        const { username, day, time, price } = req.body;
        const slot = `${day}-${time}`;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.availability.includes(slot)) return res.status(400).json({ error: 'Slot is not free' });

        if (!user.slotPrices) user.slotPrices = new Map();
        price === null || price === '' ? user.slotPrices.delete(slot) : user.slotPrices.set(slot, parseFloat(price));
        user.markModified('slotPrices');
        await user.save();
        const prices = {};
        user.slotPrices.forEach((v, k) => { prices[k] = v; });
        res.json({ success: true, slotPrices: prices });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REQUEST ROUTES ───────────────────────────────────────────────────────────
app.post('/api/requests', async (req, res) => {
    try {
        const { from, to, day, time, serviceDescription } = req.body;
        if (!day || !time) return res.status(400).json({ error: 'Day and time are required' });

        const sender = await User.findOne({ username: from });
        if (!sender) return res.status(404).json({ error: 'Sender not found' });

        const slot = `${day}-${time}`;
        if (!sender.availability.includes(slot))
            return res.status(400).json({ error: 'You must mark yourself as free for that slot first' });

        if (await Request.findOne({ from, to, day, time, status: 'pending' }))
            return res.status(400).json({ error: 'A pending request for this slot already exists' });

        await new Request({ from, to, day, time, serviceDescription: serviceDescription || '' }).save();
        await logAction('SEND_REQUEST', from, to, `${day} ${time}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/requests/:username', async (req, res) => {
    try {
        const requests = await Request.find({ to: req.params.username, status: 'pending' });
        res.json(requests);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/requests/respond', async (req, res) => {
    try {
        const { requestId, action } = req.body;
        const request = await Request.findById(requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        if (action === 'accept') {
            const { from, to, day, time } = request;
            const slot = `${day}-${time}`;
            const acceptor = await User.findOne({ username: to });
            if (!acceptor) return res.status(404).json({ error: 'Acceptor not found' });
            if (!acceptor.availability.includes(slot))
                return res.status(400).json({ error: `Your slot ${day} ${time} is not marked free.` });

            await User.updateOne({ username: from }, { $pull: { availability: slot } });
            await User.updateOne({ username: to }, { $pull: { availability: slot } });
            await new Event({ title: 'Meeting', day, time, participants: [from, to], status: 'confirmed' }).save();
            request.status = 'accepted';
            await logAction('ACCEPT_REQUEST', to, from, `${day} ${time}`);
        } else {
            request.status = 'rejected';
            await logAction('REJECT_REQUEST', request.to, request.from, `${request.day} ${request.time}`);
        }

        await request.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FEEDBACK ROUTES ──────────────────────────────────────────────────────────
app.post('/api/feedback', async (req, res) => {
    try {
        const { username, message, rating } = req.body;
        if (!message || message.trim().length === 0)
            return res.status(400).json({ error: 'Message is required' });
        await new Feedback({ username: username || 'anonymous', message, rating: rating || null }).save();
        await logAction('FEEDBACK_SUBMITTED', username || 'anonymous');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, 'username email isVerified isDisabled isAdmin joined serviceType zipCode');
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users/:username/toggle-status', requireAdmin, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ error: 'Cannot disable admin accounts' });

        user.isDisabled = !user.isDisabled;
        await user.save();
        await logAction('TOGGLE_USER_STATUS', req.adminUser.username, user.username, user.isDisabled ? 'disabled' : 'enabled');
        res.json({ success: true, isDisabled: user.isDisabled });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/requests', requireAdmin, async (req, res) => {
    try {
        const requests = await Request.find({}).sort({ timestamp: -1 }).limit(200);
        res.json(requests);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await Log.find({}).sort({ timestamp: -1 }).limit(500);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/feedback', requireAdmin, async (req, res) => {
    try {
        const feedback = await Feedback.find({}).sort({ timestamp: -1 });
        res.json(feedback);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/feedback/:id/status', requireAdmin, async (req, res) => {
    try {
        const fb = await Feedback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.json({ success: true, feedback: fb });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 CalConnect running at http://localhost:${PORT}`));
