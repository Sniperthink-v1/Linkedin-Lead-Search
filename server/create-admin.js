const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const hashedPassword = await bcrypt.hash("sniperthinkProduct@LeadGen", 10);

    const user = await prisma.user.create({
      data: {
        email: "techsupport@sniperthink.com",
        password: hashedPassword,
        name: "Tech Support",
        emailVerified: true,
        accountStatus: "active",
        provider: "email",
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log("Email:", user.email);
    console.log("Password: sniperthinkProduct@LeadGen");
  } catch (error) {
    if (error.code === "P2002") {
      console.log("ℹ️ User already exists");
    } else {
      console.error("❌ Error:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
