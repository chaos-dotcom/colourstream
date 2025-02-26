import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// API Settings from MiroTalk .env file
const API_KEY_SECRET = process.env.MIROTALK_API_KEY_SECRET || 'MIROTALK_API_SECRET_KEY_2024';
const JWT_KEY = process.env.MIROTALK_JWT_KEY || 'MIROTALK_JWT_SECRET_KEY_2024';
const HOST_USERS = [{ username: 'globalUsername', password: 'globalPassword' }];

interface MiroTalkMeetingResponse {
    meeting: string;
}

interface JwtTokenData {
    data: string;
}

async function generateMiroTalkToken(payload: any) {
    try {
        // Ensure presenter is a string "true" or "false"
        if (payload.presenter === true || payload.presenter === "1" || payload.presenter === "true") {
            payload.presenter = "true";
        } else {
            payload.presenter = "false";
        }
        
        // Ensure expire is a string in the format expected by MiroTalk
        if (!payload.expire) {
            payload.expire = "24h";
        }
        
        console.log('Generating token with payload:', payload);
        
        // Encrypt payload using AES encryption
        const payloadString = JSON.stringify(payload);
        const encryptedPayload = CryptoJS.AES.encrypt(payloadString, JWT_KEY).toString();

        // Constructing JWT token
        return jwt.sign({ data: encryptedPayload }, JWT_KEY, { expiresIn: '24h' });
    } catch (error) {
        console.error('Error generating token:', error);
        throw error;
    }
}

async function createMiroTalkMeeting() {
    try {
        const response = await fetch('https://video.colourstream.johnrogerscolour.co.uk/api/v1/meeting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY_SECRET // Using environment variable
            }
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`);
        }

        return await response.json() as MiroTalkMeetingResponse;
    } catch (error) {
        console.error('Error creating MiroTalk meeting:', error);
        throw error;
    }
}

async function joinMiroTalkMeeting(roomId: string, token: string, isPresenter: boolean = true) {
    try {
        const name = isPresenter ? 'presenter' : 'guest';
        const wsUrl = new URL('wss://video.colourstream.johnrogerscolour.co.uk/socket.io/');
        wsUrl.searchParams.append('EIO', '4');
        wsUrl.searchParams.append('transport', 'websocket');
        wsUrl.searchParams.append('room', roomId);
        wsUrl.searchParams.append('token', token);
        wsUrl.searchParams.append('peer_name', name);
        wsUrl.searchParams.append('peer_audio', 'true');
        wsUrl.searchParams.append('peer_video', 'true');
        wsUrl.searchParams.append('peer_screen', 'false');
        wsUrl.searchParams.append('peer_host', isPresenter ? 'true' : 'false');
        
        console.log(`Connecting to WebSocket: ${wsUrl.toString()}`);
        const ws = new WebSocket(wsUrl.toString());

        return new Promise((resolve, reject) => {
            let pingInterval: NodeJS.Timeout;
            let handshakeComplete = false;
            let joinMessageSent = false;
            let connectionUpgraded = false;

            const cleanup = () => {
                if (pingInterval) {
                    clearInterval(pingInterval);
                }
                ws.close();
            };

            ws.on('open', () => {
                console.log('WebSocket connection opened');
            });

            ws.on('message', (data) => {
                const message = data.toString();
                console.log('Received:', message);

                // Handle Socket.IO handshake
                if (message.startsWith('0{')) {
                    try {
                        const handshakeData = JSON.parse(message.substring(1));
                        console.log('Handshake data:', handshakeData);
                        
                        // Set up ping interval using server's pingInterval
                        pingInterval = setInterval(() => {
                            ws.send('2');
                        }, handshakeData.pingInterval);

                        // Send Socket.IO connection upgrade message
                        ws.send('40');
                        handshakeComplete = true;
                    } catch (e) {
                        console.warn('Failed to parse handshake data:', e);
                        cleanup();
                        reject(new Error('Failed to parse handshake data'));
                    }
                }
                // Handle connection upgrade response
                else if (message.startsWith('40{')) {
                    try {
                        connectionUpgraded = true;
                        console.log('Connection upgraded, sending join message...');
                        
                        // Send join message
                        const joinMessage = {
                            type: 'joinRoom',
                            room: roomId,
                            token: token,
                            peer_info: {
                                peer_name: name,
                                peer_audio: true,
                                peer_video: true,
                                peer_screen: false,
                                peer_host: isPresenter
                            }
                        };

                        console.log('Sending join message:', JSON.stringify(joinMessage, null, 2));
                        ws.send(`42${JSON.stringify(['joinRoom', joinMessage])}`);
                        joinMessageSent = true;
                    } catch (e) {
                        console.warn('Failed to send join message:', e);
                        cleanup();
                        reject(new Error('Failed to send join message'));
                    }
                }
                // Handle Socket.IO messages
                else if (message.startsWith('42')) {
                    try {
                        const [event, payload] = JSON.parse(message.slice(2));
                        console.log('Event:', event, 'Payload:', payload);
                        
                        if (event === 'roomJoined') {
                            console.log('Successfully joined room');
                            cleanup();
                            resolve(true);
                        } else if (event === 'error') {
                            console.error('Room join error:', payload);
                            cleanup();
                            reject(new Error(payload.error));
                        } else if (event === 'roomLocked') {
                            console.error('Room is locked');
                            cleanup();
                            reject(new Error('Room is locked'));
                        } else if (event === 'unauthorized') {
                            console.error('Unauthorized access');
                            cleanup();
                            reject(new Error('Unauthorized access'));
                        }
                    } catch (e) {
                        console.warn('Failed to parse message:', e);
                    }
                }
                // Handle ping response
                else if (message === '3') {
                    console.log('Received ping response');
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                cleanup();
                reject(error);
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
                cleanup();
                if (!handshakeComplete) {
                    reject(new Error('Connection closed before handshake completed'));
                } else if (!connectionUpgraded) {
                    reject(new Error('Connection closed before upgrade completed'));
                } else if (!joinMessageSent) {
                    reject(new Error('Connection closed before join message sent'));
                }
            });

            // Timeout after 15 seconds if no complete flow
            setTimeout(() => {
                if (!handshakeComplete || !connectionUpgraded || !joinMessageSent) {
                    cleanup();
                    reject(new Error('Connection timeout - incomplete handshake flow'));
                }
            }, 15000);
        });
    } catch (error) {
        console.error('Error joining MiroTalk meeting:', error);
        throw error;
    }
}

async function generateMeetingUrl() {
    try {
        // Create a meeting
        console.log('Creating MiroTalk meeting...');
        const meetingData = await createMiroTalkMeeting();
        console.log('Meeting created:', meetingData);

        // Generate presenter token
        const presenterPayload = {
            username: HOST_USERS[0].username,
            password: HOST_USERS[0].password,
            presenter: "1",
            expire: '24h'
        };

        console.log('\nGenerating presenter token...');
        const presenterToken = await generateMiroTalkToken(presenterPayload);

        // Construct the complete URL
        const baseUrl = meetingData.meeting;
        const url = new URL(baseUrl);
        url.searchParams.append('token', presenterToken);
        url.searchParams.append('name', 'presenter');
        url.searchParams.append('audio', '1');
        url.searchParams.append('video', '1');
        url.searchParams.append('screen', '0');
        url.searchParams.append('hide', '0');
        url.searchParams.append('notify', '0');

        console.log('\nComplete meeting URL:');
        console.log(url.toString());

        // Also generate a guest URL
        const guestPayload = {
            username: 'guest',
            password: 'guest',
            presenter: "0",
            expire: '24h'
        };

        const guestToken = await generateMiroTalkToken(guestPayload);
        const guestUrl = new URL(baseUrl);
        guestUrl.searchParams.append('token', guestToken);
        guestUrl.searchParams.append('name', 'guest');
        guestUrl.searchParams.append('audio', '1');
        guestUrl.searchParams.append('video', '1');
        guestUrl.searchParams.append('screen', '0');
        guestUrl.searchParams.append('hide', '0');
        guestUrl.searchParams.append('notify', '0');

        console.log('\nGuest meeting URL:');
        console.log(guestUrl.toString());

    } catch (error) {
        console.error('Failed to generate meeting URL:', error);
    }
}

// Generate meeting URL
generateMeetingUrl();