const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllPasskeys() {
  try {
    console.log('Deleting all WebAuthn credentials...');
    
    // Delete all WebAuthn credentials
    const result = await prisma.webAuthnCredential.deleteMany({});
    
    console.log(`Successfully deleted ${result.count} WebAuthn credentials`);
  } catch (error) {
    console.error('Error deleting WebAuthn credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllPasskeys(); 