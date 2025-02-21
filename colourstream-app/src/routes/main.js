const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Room = require('../models/Room');

// Authentication middleware
const auth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login page
router.get('/login', (req, res) => {
    res.render('login');
});

// Login handler
router.post('/login', async (req, res) => {
    const { password } = req.body;
    
    // In production, this should be stored securely
    const correctPassword = process.env.ACCESS_PASSWORD || 'password123';

    if (await bcrypt.compare(password, correctPassword)) {
        req.session.authenticated = true;
        // Redirect to the originally requested room or home
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectTo);
    } else {
        res.render('login', { error: 'Invalid password' });
    }
});

// Room access
router.get('/:identifier', auth, async (req, res) => {
    try {
        const room = await Room.findByLinkOrId(req.params.identifier);
        
        if (!room || room.status !== 'active') {
            return res.status(404).render('error', { error: 'Room not found' });
        }

        // Update last accessed timestamp
        await room.updateLastAccessed();

        // Render room view with necessary configuration
        res.render('room', {
            roomId: room.roomId,
            streamKey: room.roomId, // Same as roomId for simplicity
            miroTalkRoom: room.roomId
        });
    } catch (error) {
        res.status(500).render('error', { error: 'Something went wrong' });
    }
});

// Home page redirect to login if not authenticated
router.get('/', (req, res) => {
    if (req.session.authenticated) {
        res.render('home');
    } else {
        res.redirect('/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
