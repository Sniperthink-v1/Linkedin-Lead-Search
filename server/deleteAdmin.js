const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function deleteOldAdmin() {
  try {
    // Delete old admin
    const deleted = await prisma.user.deleteMany({
      where: {
        OR: [
          { email: "admin@leadgen.com" },
          { email: "techsupport@sniperthink.com" },
        ],
      },
    });

    console.log(`✅ Deleted ${deleted.count} admin user(s)`);
  } catch (error) {
    console.error("Error deleting admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteOldAdmin();
