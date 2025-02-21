const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    customLink: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    }
});

// Update lastAccessed timestamp on room access
roomSchema.methods.updateLastAccessed = function() {
    this.lastAccessed = Date.now();
    return this.save();
};

// Static method to create a new room
roomSchema.statics.createRoom = async function(customLink = null) {
    const roomId = require('nanoid').nanoid(10);
    const room = new this({
        roomId,
        customLink
    });
    await room.save();
    return room;
};

// Static method to find room by custom link or room ID
roomSchema.statics.findByLinkOrId = function(identifier) {
    return this.findOne({
        $or: [
            { roomId: identifier },
            { customLink: identifier }
        ],
        status: 'active'
    });
};

module.exports = mongoose.model('Room', roomSchema);
