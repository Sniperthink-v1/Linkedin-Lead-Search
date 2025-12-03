const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("./utils/auth");

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: "techsupport@sniperthink.com" },
    });

    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Hash the admin password
    const hashedPassword = await hashPassword("sniperthinkProduct@LeadGen");

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: "techsupport@sniperthink.com",
        password: hashedPassword,
        name: "Admin",
        emailVerified: true, // Admin is pre-verified
        accountStatus: "active",
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log("Email: techsupport@sniperthink.com");
    console.log("Password: sniperthinkProduct@LeadGen");
    console.log("User ID:", admin.id);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
