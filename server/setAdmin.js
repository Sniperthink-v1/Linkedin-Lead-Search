const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setAdmin() {
  try {
    const email = 'techsupport@sniperthink.com';
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      console.log('Please create the account first by signing up.');
      return;
    }

    // Update the user to be an admin
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { isAdmin: true },
    });

    console.log('✅ Successfully set admin role for:', email);
    console.log('User ID:', updatedUser.id);
    console.log('Is Admin:', updatedUser.isAdmin);
  } catch (error) {
    console.error('❌ Error setting admin role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();
