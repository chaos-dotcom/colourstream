const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Room = require('../models/Room');

// Admin middleware
const adminAuth = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Admin login page
router.get('/login', (req, res) => {
    res.render('admin/login');
});

// Admin login handler
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // In production, these should be stored securely
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUsername && await bcrypt.compare(password, adminPassword)) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { error: 'Invalid credentials' });
    }
});

// Admin dashboard
router.get('/dashboard', adminAuth, async (req, res) => {
    const rooms = await Room.find().sort('-createdAt');
    res.render('admin/dashboard', { rooms });
});

// Create new room
router.post('/rooms', adminAuth, async (req, res) => {
    try {
        const { customLink } = req.body;
        const room = await Room.createRoom(customLink);
        res.json(room);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete room
router.delete('/rooms/:id', adminAuth, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        room.status = 'inactive';
        await room.save();
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

module.exports = router;
