import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';

const JWT_KEY = 'mirotalkp2p_jwt_secret';

function generateMiroTalkToken(roomId: string): string {
  const username = `room_${roomId}`;
  const password = 'AdminTemp2024!@#$';

  // Constructing payload
  const payload = {
    username: username,
    password: password,
    presenter: "1",
  };

  // Encrypt payload using AES encryption
  const payloadString = JSON.stringify(payload);
  const encryptedPayload = CryptoJS.AES.encrypt(payloadString, JWT_KEY).toString();

  // Constructing JWT token
  return jwt.sign({ data: encryptedPayload }, JWT_KEY, { expiresIn: '24h' });
}

function testTokenGeneration() {
  try {
    // Generate a test room ID
    const roomId = crypto.randomBytes(12).toString('hex');
    console.log('Test room ID:', roomId);

    // Generate token
    console.log('\nGenerating MiroTalk token...');
    const token = generateMiroTalkToken(roomId);
    console.log('Generated token:', token);

    // Verify the token
    console.log('\nVerifying token...');
    const decoded = jwt.verify(token, JWT_KEY) as { data: string };
    console.log('JWT Verification:', decoded ? 'Success' : 'Failed');

    // Decrypt payload
    const decryptedBytes = CryptoJS.AES.decrypt(decoded.data, JWT_KEY);
    const decryptedPayload = decryptedBytes.toString(CryptoJS.enc.Utf8);
    console.log('\nDecrypted Payload:', JSON.parse(decryptedPayload));

    // Generate MiroTalk URL
    const mirotalkUrl = new URL('https://video.colourstream.johnrogerscolour.co.uk/join');
    mirotalkUrl.searchParams.append('room', roomId);
    mirotalkUrl.searchParams.append('name', 'TestUser');
    mirotalkUrl.searchParams.append('audio', '1');
    mirotalkUrl.searchParams.append('video', '1');
    mirotalkUrl.searchParams.append('screen', '0');
    mirotalkUrl.searchParams.append('hide', '0');
    mirotalkUrl.searchParams.append('notify', '0');
    mirotalkUrl.searchParams.append('token', token);
    mirotalkUrl.searchParams.append('_', Date.now().toString());
    mirotalkUrl.searchParams.append('fresh', '1');

    console.log('\nMiroTalk URL:', mirotalkUrl.toString());

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testTokenGeneration(); 