/**
 * One-time migration for bookings created before Guest FK existed.
 *
 * Run from `be/abela-be`:
 *   node scripts/migrate-booking-guest-refs.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const Guest = require("../src/models/Guest");

function hasGuestFk(gid) {
  return gid && mongoose.Types.ObjectId.isValid(gid);
}

async function main() {
  await connectDatabase();
  const col = mongoose.connection.collection("bookings");
  const docs = await col.find({}).toArray();
  let n = 0;

  for (const doc of docs) {
    if (hasGuestFk(doc.guestId)) continue;

    const email = (doc.email || "").toLowerCase().trim();
    const validIdNumber = typeof doc.guestId === "string" ? String(doc.guestId).trim() : "";

    let guest =
      (doc.userId && (await Guest.findOne({ userId: doc.userId }))) ||
      (email && (await Guest.findOne({ email }))) ||
      null;

    if (!guest) {
      guest = await Guest.create({
        userId: doc.userId || null,
        displayName: doc.customerName || "",
        email,
        phone: doc.contactNumber || "",
        address: doc.address || "",
        validIdNumber,
        validIdPhotoName: doc.guestIdPhotoName || "",
        validIdPhotoData: doc.guestIdPhotoData || "",
      });
    }

    await col.updateOne(
      { _id: doc._id },
      {
        $set: { guestId: guest._id },
        $unset: { guestIdPhotoName: "", guestIdPhotoData: "" },
      }
    );
    n += 1;
  }

  console.log(`Linked ${n} booking(s) to Guest records.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
