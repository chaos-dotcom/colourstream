"use strict";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function updateOIDCConfig() {
    try {
        console.log('Updating OIDC configuration with correct endpoints...');
        const updatedConfig = await prisma.oIDCConfig.update({
            where: { id: 'default' },
            data: {
                tokenUrl: 'https://sso.shed.gay/api/oidc/token',
                userInfoUrl: 'https://sso.shed.gay/api/oidc/userinfo',
                updatedAt: new Date()
            }
        });
        console.log('OIDC configuration updated successfully:', {
            ...updatedConfig,
            clientSecret: '********' // Don't log the actual secret
        });
    }
    catch (error) {
        console.error('Error updating OIDC config:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
updateOIDCConfig();
