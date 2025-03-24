'use strict';

const packageJson = require('../../package.json');

module.exports = {
    // Branding and customizations require a license: https://codecanyon.net/item/mirotalk-p2p-webrtc-realtime-video-conferences/38376661
    brand: {
        app: {
            language: 'en', // https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
            name: 'ColourStream Video',
            title: 'ColourStream Video<br />Free browser based Real-time video calls.<br />Simple, Secure, Fast.',
            description:
                'Start your next video call with a single click. No download, plug-in, or login is required. Just get straight to talking, messaging, and sharing your screen.',
            joinDescription: 'Pick a room name.<br />How about this one?',
            joinButtonLabel: 'JOIN ROOM',
            joinLastLabel: 'Your recent room:',
        },
        og: {
            type: 'app-webrtc',
            siteName: 'ColourStream Video',
            title: 'Click the link to make a call.',
            description:
                'ColourStream Video calling provides real-time HD quality and latency simply not available with traditional technology.',
            image: 'https://video.colourstream.johnrogers.co.uk/images/preview.png',
            url: 'https://video.colourstream.johnrogers.co.uk',
        },
        site: {
            shortcutIcon: '../images/logo.svg',
            appleTouchIcon: '../images/logo.svg',
            landingTitle: 'ColourStream Video a Free Secure Video Calls, Chat & Screen Sharing.',
            newCallTitle: 'ColourStream Video a Free Secure Video Calls, Chat & Screen Sharing.',
            newCallRoomTitle: 'Pick name. <br />Share URL. <br />Start conference.',
            newCallRoomDescription:
                "Each room has its disposable URL. Just pick a room name and share your custom URL. It's that easy.",
            loginTitle: 'ColourStream Video - Host Protected login required.',
            clientTitle: 'ColourStream Video WebRTC Video call, Chat Room & Screen Sharing.',
            privacyPolicyTitle: 'ColourStream Video - privacy and policy.',
            stunTurnTitle: 'Test Stun/Turn Servers.',
            notFoundTitle: 'ColourStream Video - 404 Page not found.',
        },
        html: {
            features: true,
            browsers: true,
            teams: true, // please keep me always true ;)
            tryEasier: true,
            poweredBy: true,
            sponsors: true,
            advertisers: true,
            footer: true,
        },
        about: {
            imageUrl: '../images/mirotalk-logo.gif',
            title: `WebRTC P2P v${packageJson.version}`,
            html: `
                <button 
                    id="support-button" 
                    data-umami-event="Support button" 
                    onclick="window.open('https://codecanyon.net/user/miroslavpejic85')">
                    <i class="fas fa-heart" ></i>&nbsp;Support
                </button>
                <br /><br /><br />
                Author:<a 
                    id="linkedin-button" 
                    data-umami-event="Linkedin button" 
                    href="https://www.linkedin.com/in/miroslav-pejic-976a07101/" target="_blank"> 
                    Miroslav Pejic
                </a>
                <br /><br />
                Email:<a 
                    id="email-button" 
                    data-umami-event="Email button" 
                    href="mailto:miroslav.pejic.85@gmail.com?subject=ColourStream Video P2P info"> 
                    miroslav.pejic.85@gmail.com
                </a>
                <br /><br />
                <hr />
                <span>&copy; 2025 ColourStream Video P2P, all rights reserved</span>
                <hr />
            `,
        },
        //...
    },
    /**
     * Configuration for controlling the visibility of buttons in the ColourStream Video P2P client.
     * Set properties to true to show the corresponding buttons, or false to hide them.
     * captionBtn, showSwapCameraBtn, showScreenShareBtn, showFullScreenBtn, showVideoPipBtn, showDocumentPipBtn -> (auto-detected).
     */
    buttons: {
        main: {
            showShareRoomBtn: false, // For guests
            showHideMeBtn: false,
            showAudioBtn: true,
            showVideoBtn: true,
            showScreenBtn: false, // autodetected
            showRecordStreamBtn: false,
            showChatRoomBtn: false,
            showCaptionRoomBtn: false,
            showRoomEmojiPickerBtn: false,
            showMyHandBtn: false,
            showWhiteboardBtn: false,
            showSnapshotRoomBtn: false,
            showFileShareBtn: false,
            showDocumentPipBtn: false,
            showMySettingsBtn: true,
            showAboutBtn: false, // Please keep me always true, Thank you!
        },
        chat: {
            showTogglePinBtn: false,
            showMaxBtn: false,
            showSaveMessageBtn: false,
            showMarkDownBtn: false,
            showChatGPTBtn: false,
            showFileShareBtn: false,
            showShareVideoAudioBtn: false,
            showParticipantsBtn: false,
        },
        caption: {
            showTogglePinBtn: false,
            showMaxBtn: false,
        },
        settings: {
            showMicOptionsBtn: true,
            showTabRoomPeerName: true,
            showTabRoomParticipants: true,
            showTabRoomSecurity: false,
            showTabEmailInvitation: false,
            showCaptionEveryoneBtn: true,
            showMuteEveryoneBtn: false,
            showHideEveryoneBtn: false,
            showEjectEveryoneBtn: false,
            showLockRoomBtn: false,
            showUnlockRoomBtn: false,
            showShortcutsBtn: false,
        },
        remote: {
            showAudioVolume: true,
            audioBtnClickAllowed: false,
            videoBtnClickAllowed: false,
            showVideoPipBtn: false,
            showKickOutBtn: false,
            showSnapShotBtn: false,
            showFileShareBtn: false,
            showShareVideoAudioBtn: false,
            showPrivateMessageBtn: false,
            showZoomInOutBtn: false,
            showVideoFocusBtn: false,
        },
        local: {
            showVideoPipBtn: false,
            showSnapShotBtn: false,
            showVideoCircleBtn: false,
            showZoomInOutBtn: false,
        },
        whiteboard: {
            whiteboardLockBtn: false,
        },
    },
};
