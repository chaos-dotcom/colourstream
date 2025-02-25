const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearWebAuthnCredentials() {
  try {
    const result = await prisma.webAuthnCredential.deleteMany();
    console.log(`Deleted ${result.count} WebAuthn credentials`);
  } catch (error) {
    console.error('Error clearing WebAuthn credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearWebAuthnCredentials(); 