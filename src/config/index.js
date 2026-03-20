const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
});

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
