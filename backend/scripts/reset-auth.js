const { PrismaClient } = require('@prisma/client');

async function resetAuth() {
    const prisma = new PrismaClient();
    try {
        console.log('Starting WebAuthn credentials cleanup...');
        const deleted = await prisma.webAuthnCredential.deleteMany({});
        console.log(`Successfully deleted ${deleted.count} WebAuthn credentials`);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Only run if directly executed
if (require.main === module) {
    resetAuth()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} 