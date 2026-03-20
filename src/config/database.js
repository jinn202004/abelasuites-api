const mongoose = require("mongoose");
const { MONGODB_URI } = require("./index");

async function connectDatabase() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in .env");
  }
  await mongoose.connect(MONGODB_URI);
  console.log(
    "MongoDB connected:",
    mongoose.connection.name,
    "@",
    mongoose.connection.host
  );
}

module.exports = { connectDatabase };
