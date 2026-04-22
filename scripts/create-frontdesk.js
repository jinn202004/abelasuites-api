/**
 * Create or promote a front desk user (MongoDB).
 *
 * Usage:
 *   node scripts/create-frontdesk.js <email> <password>
 *   npm run create-frontdesk -- frontdesk@hotel.com 'YourPass1!'
 *
 * Or set FRONTDESK_EMAIL and FRONTDESK_PASSWORD in `.env` and run with no args.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const User = require("../src/models/User");

async function main() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];
  const email = (emailArg || process.env.FRONTDESK_EMAIL || "").trim();
  const password = passwordArg || process.env.FRONTDESK_PASSWORD || "";

  if (!email || !password) {
    console.error("Missing email or password.");
    console.error("");
    console.error("  node scripts/create-frontdesk.js <email> <password>");
    console.error("  npm run create-frontdesk -- frontdesk@abela.demo 'MySecurePass1!'");
    console.error("");
    console.error("Or set FRONTDESK_EMAIL and FRONTDESK_PASSWORD in .env and run:");
    console.error("  npm run create-frontdesk");
    process.exit(1);
  }

  await connectDatabase();

  const normalized = email.toLowerCase().trim();
  const passwordHash = await User.hashPassword(password);

  const usersCol = mongoose.connection.collection("users");
  const now = new Date();
  const res = await usersCol.updateOne(
    { email: normalized },
    {
      $set: {
        email: normalized,
        passwordHash,
        role: "frontdesk",
        firstName: "Front",
        lastName: "Desk",
        username: normalized,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  if (res.upsertedCount === 1) {
    console.log("Created front desk user:", normalized);
  } else {
    console.log("Updated existing user to front desk:", normalized);
  }

  console.log("Sign in at /login with this email and password (JWT required for staff APIs).");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
