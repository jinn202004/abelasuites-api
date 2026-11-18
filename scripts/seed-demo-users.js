/**

 * Create demo users that match the frontend demo accounts (`fe/abela-fe/src/logIn/*DemoAuth.js`).

 * Without these rows in MongoDB, email login hits the API first; if that fails, the app falls

 * back to "demo mode" with NO JWT — bookings are not saved, housekeeping bells stay empty

 * (`GET /api/housekeeping/tasks` requires a Bearer token), and staff APIs are unavailable.

 *

 * Usage:

 *   npm run seed-demo

 *

 * Requires MONGODB_URI in `.env` (see `.env.example`).

 */

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });



const mongoose = require("mongoose");

const { connectDatabase } = require("../src/config/database");

const User = require("../src/models/User");



const DEMO_PASSWORD = "12345678";



const ACCOUNTS = [
  { email: "guest@abela.demo", role: "guest", firstName: "Demo", lastName: "Guest", phone: "09171234567" },
  {
    email: "frontdesk@abela.demo",
    role: "frontdesk",
    firstName: "Demo",
    lastName: "FrontDesk",
    phone: "09171234501",
    department: "Front Office",
    staffStatus: "Active",
  },
  {
    email: "housekeeping@abela.demo",
    role: "housekeeping",
    firstName: "Demo",
    lastName: "Housekeeping",
    phone: "09171234502",
    department: "Housekeeping",
    staffStatus: "Active",
  },
  {
    email: "cashier@abela.demo",
    role: "cashier",
    firstName: "Demo",
    lastName: "Cashier",
    phone: "09171234503",
    department: "Restaurant",
    staffStatus: "Active",
  },
];

async function upsertUser({
  email,
  role,
  firstName,
  lastName,
  phone = "",
  department = "",
  staffStatus = "Active",
}) {

  const normalized = email.toLowerCase().trim();

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  const usersCol = mongoose.connection.collection("users");

  const now = new Date();

  const res = await usersCol.updateOne(

    { email: normalized },

    {

      $set: {
        email: normalized,
        passwordHash,
        role,
        firstName,
        lastName,
        name: [firstName, lastName].filter(Boolean).join(" ").trim(),
        phone: String(phone || "").trim(),
        department: String(department || "").trim(),
        staffStatus: String(staffStatus || "Active").trim(),
        username: normalized,
        updatedAt: now,
      },

      $setOnInsert: { createdAt: now },

    },

    { upsert: true }

  );

  if (res.upsertedCount === 1) {

    console.log("Created:", normalized, `(${role})`);

  } else {

    console.log("Updated:", normalized, `(${role})`);

  }

}



async function main() {

  await connectDatabase();

  for (const row of ACCOUNTS) {

    await upsertUser(row);

  }

  console.log("");

  console.log("Password for all demo accounts:", DEMO_PASSWORD);

  console.log("Log in at /login with these emails so POST /api/auth/login stores a JWT.");

  await mongoose.disconnect();

  process.exit(0);

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


