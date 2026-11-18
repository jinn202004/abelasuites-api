const mongoose = require("mongoose");
const { MONGODB_URI } = require("./index");
const { MONGOOSE_CONNECT_OPTIONS } = require("./mongooseOptions");

let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("[mongo] disconnected — driver will retry automatically");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[mongo] reconnected to", mongoose.connection.host);
  });
  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err.message);
  });
}

async function connectDatabase() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in .env (copy .env.example to .env)");
  }

  registerConnectionListeners();

  await mongoose.connect(MONGODB_URI, MONGOOSE_CONNECT_OPTIONS);
  console.log(
    "MongoDB connected:",
    mongoose.connection.name,
    "@",
    mongoose.connection.host
  );
}

module.exports = { connectDatabase };
