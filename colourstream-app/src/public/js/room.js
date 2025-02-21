// Room functionality
document.addEventListener('DOMContentLoaded', function() {
    let player = null;

    // Initialize OvenPlayer
    function initializePlayer(streamKey) {
        player = OvenPlayer.create('ovenplayer', {
            sources: [
                {
                    type: 'webrtc',
                    file: `wss://${window.location.hostname}/ovenmediaengine/app/${streamKey}`,
                }
            ],
            autoStart: true,
            controls: true,
        });

        // Handle player events
        player.on('error', function(error) {
            console.error('Player error:', error);
            // You might want to show a user-friendly error message here
        });

        player.on('stateChanged', function(state) {
            console.log('Player state changed:', state);
        });
    }

    // Handle window resize
    function handleResize() {
        const container = document.querySelector('.container');
        const windowHeight = window.innerHeight;
        
        // Set container to full viewport height
        container.style.height = `${windowHeight}px`;

        // Resize player if initialized
        if (player) {
            player.resize();
        }
    }

    // Initial setup
    window.addEventListener('resize', handleResize);
    handleResize();

    // Initialize player with stream key from template
    const streamKey = document.getElementById('ovenplayer').dataset.streamKey;
    if (streamKey) {
        initializePlayer(streamKey);
    }

    // Handle fullscreen toggle
    document.addEventListener('keydown', function(e) {
        // Press F to toggle fullscreen
        if (e.key.toLowerCase() === 'f') {
            const playerElement = document.getElementById('ovenplayer');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                playerElement.requestFullscreen();
            }
        }
    });

    // Handle visibility change to manage resources
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Page is hidden, pause video if playing
            if (player && player.getState() === 'playing') {
                player.pause();
            }
        } else {
            // Page is visible again, resume if was playing
            if (player && player.getState() === 'paused') {
                player.play();
            }
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        if (player) {
            player.destroy();
        }
    });
});
