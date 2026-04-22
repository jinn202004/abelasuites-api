/**
 * Create or promote an admin user (MongoDB).
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password>
 *   npm run create-admin -- admin@example.com 'YourPass1!'
 *
 * Or set ADMIN_EMAIL and ADMIN_PASSWORD in `.env` and run with no args.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const User = require("../src/models/User");

async function main() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];
  const email = (emailArg || process.env.ADMIN_EMAIL || "").trim();
  const password = passwordArg || process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.error("Missing email or password.");
    console.error("");
    console.error("  node scripts/create-admin.js <email> <password>");
    console.error("  npm run create-admin -- admin@abela.local 'AdminPass1!'");
    console.error("");
    console.error("Or set ADMIN_EMAIL and ADMIN_PASSWORD in .env and run:");
    console.error("  npm run create-admin");
    process.exit(1);
  }

  await connectDatabase();

  const normalized = email.toLowerCase().trim();
  const passwordHash = await User.hashPassword(password);

  /**
   * Some databases still have a legacy unique index on `username`. Setting
   * `username` to the email avoids E11000 on `username: null` when inserting.
   */
  const usersCol = mongoose.connection.collection("users");
  const now = new Date();
  const res = await usersCol.updateOne(
    { email: normalized },
    {
      $set: {
        email: normalized,
        passwordHash,
        role: "admin",
        firstName: "Admin",
        lastName: "",
        username: normalized,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  if (res.upsertedCount === 1) {
    console.log("Created admin user:", normalized);
  } else {
    console.log("Updated existing user to admin:", normalized);
  }

  console.log("You can log in via POST /api/auth/login with this email and password.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
