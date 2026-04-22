/**
 * Create or promote a housekeeping user (MongoDB).
 *
 * Usage:
 *   node scripts/create-housekeeping.js
 *   node scripts/create-housekeeping.js <email> <password>
 *   npm run create-housekeeping
 *   npm run create-housekeeping -- housekeeping@hotel.com Housekeep1!
 *
 * With no args: uses HOUSEKEEPING_EMAIL / HOUSEKEEPING_PASSWORD from `.env`, or
 * defaults to housekeeping@abela.local / Housekeep1!
 *
 * Windows (cmd.exe): npm run create-housekeeping -- housekeeping@abela.local Housekeep1!
 * PowerShell: npm run create-housekeeping -- housekeeping@abela.local Housekeep1!
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const User = require("../src/models/User");

const DEFAULT_EMAIL = "housekeeping@abela.local";
const DEFAULT_PASSWORD = "Housekeep1!";

async function main() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];
  const email = (
    emailArg ||
    process.env.HOUSEKEEPING_EMAIL ||
    DEFAULT_EMAIL
  )
    .trim()
    .toLowerCase();
  const password =
    passwordArg || process.env.HOUSEKEEPING_PASSWORD || DEFAULT_PASSWORD;

  if (!emailArg && !process.env.HOUSEKEEPING_EMAIL) {
    console.log(
      "No email argument: using default",
      DEFAULT_EMAIL,
      "(override with args or HOUSEKEEPING_EMAIL in .env)"
    );
  }
  if (!passwordArg && !process.env.HOUSEKEEPING_PASSWORD) {
    console.log(
      "No password argument: using default dev password (override with args or HOUSEKEEPING_PASSWORD in .env)"
    );
  }

  try {
    await connectDatabase();
  } catch (err) {
    console.error("");
    console.error("Could not connect to MongoDB.");
    console.error("- Set MONGODB_URI in be/abela-be/.env (copy from .env.example).");
    console.error("- Atlas: Network Access → allow your IP; check password in connection string.");
    console.error("- Local: start mongod or Docker Mongo on that host/port.");
    console.error("");
    console.error(err.message || err);
    process.exit(1);
  }

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
        role: "housekeeping",
        firstName: "Housekeeping",
        lastName: "",
        username: normalized,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  if (res.upsertedCount === 1) {
    console.log("Created housekeeping user:", normalized);
  } else {
    console.log("Updated existing user to housekeeping:", normalized);
  }

  console.log("Sign in at /login with this email and password (JWT required for staff APIs).");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
