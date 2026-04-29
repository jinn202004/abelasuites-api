/**
 * Sets isApproved=true on all reviews that are still pending.
 * Use after enabling testimonials or if reviews were submitted while AUTO_APPROVE was off.
 *
 * Run from `be/abela-be`:
 *   npm run approve-reviews
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const Review = require("../src/models/Review");

async function main() {
  await connectDatabase();
  const res = await Review.updateMany({ isApproved: false }, { $set: { isApproved: true } });
  console.log(
    `Pending reviews matched: ${res.matchedCount}. Updated to approved: ${res.modifiedCount}.`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
