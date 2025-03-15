// This script fixes any UploadLink records in the database that have null maxUses values
// Run this script with: node fix-max-uses.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMaxUsesValues() {
  console.log('Starting database repair for UploadLink records with null maxUses...');
  
  try {
    // Fetch all UploadLink records with null maxUses
    const uploadLinksWithNullMaxUses = await prisma.$queryRaw`
      SELECT id FROM "UploadLink" WHERE "maxUses" IS NULL
    `;
    
    console.log(`Found ${uploadLinksWithNullMaxUses.length} records with null maxUses`);
    
    // If there are records to fix
    if (uploadLinksWithNullMaxUses.length > 0) {
      // Update each record
      for (const link of uploadLinksWithNullMaxUses) {
        console.log(`Fixing record with ID: ${link.id}`);
        // Use a proper Prisma update operation to set maxUses to null
        await prisma.uploadLink.update({
          where: { id: link.id },
          data: { maxUses: null }
        });
      }
      console.log('All records updated successfully!');
    } else {
      console.log('No records need fixing.');
    }
  } catch (error) {
    console.error('Error fixing records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMaxUsesValues(); 