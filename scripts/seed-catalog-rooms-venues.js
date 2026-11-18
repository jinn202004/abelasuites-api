/**
 * Restore Abela room + event venue catalog rows in MongoDB.
 *
 * Usage:
 *   npm run seed:catalog
 *
 * Upserts by unique `roomNumber` / `eventNum` — safe to re-run; updates fields
 * without deleting custom admin edits to prices/images unless listed below.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const Room = require("../src/models/Room");
const EventVenue = require("../src/models/EventVenue");

/**
 * Canonical room catalog from the original admin Room Management defaults
 * (`fe/abela-fe/src/admin_1/room-management.jsx` → INITIAL_ROOMS in OneDrive backup).
 */
const ROOMS = [
  {
    title: "Single Suites",
    roomNumber: "1",
    package: "Single Suites",
    price: 824,
    guests: 2,
    description: "",
    features: [],
    image: "/images/single.jpg",
    status: "available",
  },
  {
    title: "Twin Bed",
    roomNumber: "2",
    package: "Twin Bed",
    price: 1148,
    guests: 3,
    description: "",
    features: [],
    image: "/images/single.jpg",
    status: "available",
  },
  {
    title: "Double Standard",
    roomNumber: "3",
    package: "Double Standard",
    price: 1226,
    guests: 5,
    description: "",
    features: [],
    image: "/images/double.jpg",
    status: "available",
  },
  {
    title: "Matrimonial",
    roomNumber: "4",
    package: "Matrimonial",
    price: 1383,
    guests: 2,
    description: "",
    features: [],
    image: "/images/Matrimonial.jpg",
    status: "available",
  },
  {
    title: "Family",
    roomNumber: "5",
    package: "Family",
    price: 1666,
    guests: 6,
    description: "",
    features: [],
    image: "/images/family.jpg",
    status: "available",
  },
];

/** Wrong demo rows created after the DB reset (RM01–RM06 etc.). */
const STALE_ROOM_NUMBERS = [
  "RM01", "RM02", "RM03", "RM04", "RM05", "RM06",
  "RM001", "RM002", "RM003", "RM004", "RM005",
];

const EVENT_VENUES = [
  {
    eventNum: "EV001",
    name: "Mini Sky Bar",
    package: "Mini Sky Bar",
    type: "Rooftop venue",
    limit: "30–40 Guests",
    capacity: 40,
    price: 1148,
    location: "Rooftop",
    description: "Perfect for debuts, seminars, meetings, birthdays, and more.",
    features: ["30 Chairs", "Speaker", "10 Tables", "Microphone"],
    housekeeping: [],
    image: "https://www.therooftopguide.com/rooftop-bars-in-hanoi/Bilder/moonlight-sky-bar-600-3.jpg",
    status: "available",
  },
  {
    eventNum: "EV002",
    name: "Function Hall",
    package: "Function Hall",
    type: "Banquet hall",
    limit: "20–30 Guests",
    capacity: 30,
    price: 2205,
    location: "Ground floor",
    description: "With free breakfast, private toilet and bath, aircon, and WiFi.",
    features: ["30 Chairs", "Speaker", "10 Tables", "Microphone", "Smart TV", "Air Conditioning"],
    housekeeping: [],
    image: "/venue-function-hall.png",
    status: "available",
  },
  {
    eventNum: "EV003",
    name: "Garden Venue",
    package: "Garden Venue",
    type: "Outdoor venue",
    limit: "50–80 Guests",
    capacity: 80,
    price: 3500,
    location: "Garden area",
    description: "Open-air garden venue for weddings, parties, and celebrations.",
    features: ["Garden setup", "Tables & chairs", "Sound system", "Lighting"],
    housekeeping: [],
    image: "",
    status: "available",
  },
  {
    eventNum: "EV004",
    name: "Grand Ballroom",
    package: "Grand Ballroom",
    type: "Ballroom",
    limit: "100–150 Guests",
    capacity: 150,
    price: 12500,
    location: "Main hall",
    description: "Elegant grand ballroom for large weddings, galas, and corporate events.",
    features: ["Stage", "Premium sound", "Banquet tables", "Air conditioning", "Bridal suite access"],
    housekeeping: [],
    image: "",
    status: "available",
  },
];

async function upsertRoom(row) {
  const roomsCol = mongoose.connection.collection("rooms");
  const now = new Date();
  const res = await roomsCol.updateOne(
    { roomNumber: row.roomNumber },
    {
      $set: {
        title: row.title,
        roomNumber: row.roomNumber,
        package: row.package,
        price: row.price,
        guests: row.guests,
        description: row.description,
        features: row.features,
        image: row.image,
        status: row.status,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  const action = res.upsertedCount === 1 ? "Created" : "Updated";
  console.log(`${action} room:`, row.roomNumber, `(${row.package})`);
}

async function upsertEventVenue(row) {
  const col = mongoose.connection.collection("eventvenues");
  const now = new Date();
  const res = await col.updateOne(
    { eventNum: row.eventNum },
    {
      $set: {
        eventNum: row.eventNum,
        name: row.name,
        package: row.package,
        type: row.type,
        limit: row.limit,
        capacity: row.capacity,
        price: row.price,
        location: row.location,
        description: row.description,
        features: row.features,
        housekeeping: row.housekeeping,
        image: row.image,
        status: row.status,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  const action = res.upsertedCount === 1 ? "Created" : "Updated";
  console.log(`${action} venue:`, row.eventNum, `(${row.name})`);
}

async function removeStaleRooms() {
  const roomsCol = mongoose.connection.collection("rooms");
  const res = await roomsCol.deleteMany({ roomNumber: { $in: STALE_ROOM_NUMBERS } });
  if (res.deletedCount > 0) {
    console.log(`Removed ${res.deletedCount} incorrect demo room row(s).`);
  }
}

async function main() {
  await connectDatabase();
  await removeStaleRooms();
  for (const row of ROOMS) {
    await upsertRoom(row);
  }
  for (const row of EVENT_VENUES) {
    await upsertEventVenue(row);
  }
  const roomCount = await Room.countDocuments();
  const venueCount = await EventVenue.countDocuments();
  console.log("");
  console.log(`Catalog restored: ${roomCount} room(s), ${venueCount} event venue(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
