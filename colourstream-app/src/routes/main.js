const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
// Room access - no authentication required, just valid room link
router.get('/:identifier', async (req, res) => {
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

// Home page shows error
router.get('/', (req, res) => {
    res.status(404).render('error', { error: 'Page not found' });
});

module.exports = router;
