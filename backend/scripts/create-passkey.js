const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const base64url = require('base64url');

const prisma = new PrismaClient();

async function createDummyPasskey() {
  try {
    console.log('Creating dummy passkey for admin user...');
    
    // Generate random credential ID and public key
    const credentialId = base64url.encode(crypto.randomBytes(32));
    const publicKey = base64url.encode(crypto.randomBytes(65));
    
    // Create a dummy WebAuthn credential
    const credential = await prisma.webAuthnCredential.create({
      data: {
        userId: 'admin',
        credentialId: credentialId,
        publicKey: publicKey,
        counter: 0,
        transports: 'internal',
        credentialDeviceType: 'platform',
        credentialBackedUp: false,
        createdAt: new Date(),
        lastUsed: new Date(),
        name: 'Admin Passkey'
      }
    });
    
    console.log('Dummy passkey created successfully:', credential);
  } catch (error) {
    console.error('Error creating dummy passkey:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDummyPasskey(); 