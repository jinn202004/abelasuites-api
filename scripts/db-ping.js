/**
 * Verify MongoDB using the same MONGODB_URI as the API (be/abela-be/.env).
 * Run: npm run db:ping
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;
if (!uri || !String(uri).trim()) {
  console.error("MONGODB_URI is missing. Copy .env.example to .env and set MONGODB_URI.");
  process.exit(1);
}

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 15_000 })
  .then(() => {
    console.log("OK — connected to database:", mongoose.connection.name);
    console.log("   host:", mongoose.connection.host || "(srv)");
    return mongoose.disconnect();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED — could not connect to MongoDB.");
    console.error("   ", err.message);
    console.error("");
    console.error("Check: MongoDB is running (local) or Atlas cluster is not paused;");
    console.error("      Network / VPN; IP allowlist (Atlas); MONGODB_URI in be/abela-be/.env");
    return mongoose.disconnect().finally(() => process.exit(1));
  });
