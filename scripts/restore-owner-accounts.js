/**
 * Restore real owner/admin accounts (only creates missing rows; does not reset passwords).
 *
 * Usage:
 *   npm run restore-owners
 *
 * Optional env overrides in `.env`:
 *   OWNER_DEFAULT_PASSWORD=YourPass1!
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const User = require("../src/models/User");

const DEFAULT_PASSWORD = process.env.OWNER_DEFAULT_PASSWORD || "Abela@2026";

/** Real accounts that should always exist in Staff Management. */
const OWNER_ACCOUNTS = [
  {
    email: "joanahfaye1@gmail.com",
    role: "admin",
    firstName: "Joanah",
    lastName: "Faye",
    phone: "09556678908",
    department: "Management",
    staffStatus: "Active",
  },
  {
    email: "janah@gmail.com",
    role: "housekeeping",
    firstName: "Janah",
    lastName: "Cultura",
    phone: "09978840614",
    department: "Housekeeping",
    staffStatus: "Active",
  },
];

async function restoreAccount(account) {
  const normalized = account.email.toLowerCase().trim();
  const usersCol = mongoose.connection.collection("users");
  const now = new Date();
  const name = [account.firstName, account.lastName].filter(Boolean).join(" ").trim();

  const existing = await usersCol.findOne({ email: normalized });
  if (existing) {
    await usersCol.updateOne(
      { email: normalized },
      {
        $set: {
          role: account.role,
          firstName: account.firstName,
          lastName: account.lastName,
          name,
          phone: String(account.phone || "").trim(),
          department: String(account.department || "").trim(),
          staffStatus: account.staffStatus || "Active",
          username: normalized,
          updatedAt: now,
        },
      }
    );
    console.log("Restored profile (kept password):", normalized, `(${account.role})`);
    return;
  }

  const passwordHash = await User.hashPassword(DEFAULT_PASSWORD);
  await usersCol.insertOne({
    email: normalized,
    username: normalized,
    passwordHash,
    role: account.role,
    firstName: account.firstName,
    lastName: account.lastName,
    name,
    phone: String(account.phone || "").trim(),
    department: String(account.department || "").trim(),
    staffStatus: account.staffStatus || "Active",
    createdAt: now,
    updatedAt: now,
  });
  console.log("Created:", normalized, `(${account.role})`);
}

async function main() {
  await connectDatabase();
  for (const row of OWNER_ACCOUNTS) {
    await restoreAccount(row);
  }
  console.log("");
  console.log("New accounts use temporary password:", DEFAULT_PASSWORD);
  console.log("Change passwords after logging in if needed.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
