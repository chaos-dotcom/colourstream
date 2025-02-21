const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { 
    authenticateAdmin, 
    validateAdminCredentials, 
    rateLimitLogin,
    clearLoginAttempts 
} = require('../middleware/auth');

// Admin login page
router.get('/', (req, res) => {
    if (req.session.isAdmin) {
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login');
    }
});

// Admin login handler
router.post('/', rateLimitLogin, async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const isValid = await validateAdminCredentials(username, password);
        if (isValid) {
            req.session.isAdmin = true;
            clearLoginAttempts(req.ip);
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/login', { error: 'Invalid credentials' });
        }
    } catch (error) {
        res.render('admin/login', { error: error.message });
    }
});

// Admin dashboard
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    const rooms = await Room.find().sort('-createdAt');
    res.render('admin/dashboard', { rooms });
});

// Create new room
router.post('/rooms', authenticateAdmin, async (req, res) => {
    try {
        const { customLink } = req.body;
        // Generate a unique identifier if no custom link provided
        const roomId = customLink || Math.random().toString(36).substring(2, 10);
        const room = await Room.createRoom(roomId);
        
        // Include the full room URL in the response
        const roomUrl = `https://colourstream.johnrogerscolour.co.uk/${room.roomId}`;
        res.json({ 
            ...room.toJSON(),
            roomUrl
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete room
router.delete('/rooms/:id', authenticateAdmin, async (req, res) => {
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
    res.redirect('/admin');
});

module.exports = router;
