const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const roomRoutes = require("./room.routes");
const eventVenueRoutes = require("./eventVenue.routes");
const bookingRoutes = require("./booking.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/event-venues", eventVenueRoutes);
router.use("/bookings", bookingRoutes);

module.exports = router;
