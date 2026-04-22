const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  app.use(cors());
  // Guest bookings send base64 ID images in JSON; default 100kb is too small.
  app.use(express.json({ limit: "15mb" }));
  app.use("/api", apiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
