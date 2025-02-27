import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
// import WebSocket from 'ws';

// API Settings from MiroTalk .env file
const API_KEY_SECRET = process.env.MIROTALK_API_KEY_SECRET || 'MIROTALK_API_SECRET_KEY_2024';
const JWT_KEY = process.env.JWT_KEY || 'MIROTALK_JWT_SECRET_KEY_2024';
const HOST_USERS = [{ username: 'globalUsername', password: 'globalPassword' }];

interface MiroTalkMeetingResponse {
    meeting: string;
}

// For potential future use
// interface JwtTokenData {
//     data: string;
// }

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

// For potential future use
// async function joinMiroTalkMeeting(roomId: string, token: string, isPresenter: boolean = true) {
// ... function body ...
// }

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