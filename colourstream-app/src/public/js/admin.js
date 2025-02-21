// Admin dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Room creation form handling
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const customLink = document.getElementById('customLink').value;
            
            try {
                const response = await fetch('/admin/rooms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ customLink })
                });

                if (!response.ok) {
                    throw new Error('Failed to create room');
                }

                // Reload page to show new room
                window.location.reload();
            } catch (error) {
                console.error('Error creating room:', error);
                alert('Failed to create room: ' + error.message);
            }
        });
    }

    // Room deletion handling
    window.deleteRoom = async function(roomId) {
        if (!confirm('Are you sure you want to delete this room?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/rooms/${roomId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete room');
            }

            // Reload page to update room list
            window.location.reload();
        } catch (error) {
            console.error('Error deleting room:', error);
            alert('Failed to delete room: ' + error.message);
        }
    };

    // Copy room link functionality
    window.copyRoomLink = function(identifier) {
        const link = `${window.location.origin}/${identifier}`;
        navigator.clipboard.writeText(link)
            .then(() => {
                // Create and show temporary success message
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy link:', err);
                alert('Failed to copy link to clipboard');
            });
    };

    // Auto-generate random room ID
    window.generateRandomId = function() {
        const customLinkInput = document.getElementById('customLink');
        const randomId = Math.random().toString(36).substring(2, 10);
        customLinkInput.value = randomId;
    };

    // Add timestamp tooltips
    const timestamps = document.querySelectorAll('.timestamp');
    timestamps.forEach(timestamp => {
        const date = new Date(timestamp.getAttribute('data-time'));
        timestamp.title = date.toLocaleString();
    });

    // Room status indicators
    const statusIndicators = document.querySelectorAll('.status');
    statusIndicators.forEach(indicator => {
        const status = indicator.getAttribute('data-status');
        indicator.classList.add(`status-${status}`);
    });
});
