const { PrismaClient } = require("@prisma/client");
const { comparePassword } = require("./utils/auth");

const prisma = new PrismaClient();

async function checkAdminCredentials() {
  try {
    const email = "techsupport@sniperthink.com";
    const password = "sniperthinkProduct@LeadGen";

    console.log("\n🔍 Checking admin credentials...");
    console.log("Email:", email);

    // Find admin user
    const admin = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        emailVerified: true,
        accountStatus: true,
        createdAt: true,
      },
    });

    if (!admin) {
      console.log("❌ Admin user not found in database");
      return;
    }

    console.log("\n✅ Admin user found:");
    console.log("ID:", admin.id);
    console.log("Name:", admin.name);
    console.log("Email:", admin.email);
    console.log("Email Verified:", admin.emailVerified);
    console.log("Account Status:", admin.accountStatus);
    console.log("Created At:", admin.createdAt);

    // Verify password
    const isPasswordValid = await comparePassword(password, admin.password);

    console.log("\n🔐 Password verification:");
    console.log(
      "Test Password:",
      password
    );
    console.log("Password Valid:", isPasswordValid ? "✅ YES" : "❌ NO");

    if (isPasswordValid) {
      console.log("\n✅ Credentials are correct!");
      console.log("You can login with:");
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    } else {
      console.log("\n❌ Password does not match!");
    }
  } catch (error) {
    console.error("Error checking admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminCredentials();
