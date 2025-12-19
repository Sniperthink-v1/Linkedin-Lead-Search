const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("./utils/auth");

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: "testaccount@gmail.com" },
    });

    if (existing) {
      console.log("Test user already exists:", existing.email);
      return;
    }

    const hashed = await hashPassword("Test@12345");

    const user = await prisma.user.create({
      data: {
        email: "testaccount@gmail.com",
        password: hashed,
        name: "Test Account",
        emailVerified: true,
        accountStatus: "active",
      },
    });

    console.log("✅ Test user created:", user.email);
  } catch (err) {
    console.error("Error creating test user:", err);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
