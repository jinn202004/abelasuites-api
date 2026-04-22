const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const roomRoutes = require("./room.routes");
const eventVenueRoutes = require("./eventVenue.routes");
const bookingRoutes = require("./booking.routes");
const staffRoutes = require("./staff.routes");
const staffNotificationsRoutes = require("./staffNotifications.routes");
const housekeepingRoutes = require("./housekeeping.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/event-venues", eventVenueRoutes);
router.use("/bookings", bookingRoutes);
router.use("/staff", staffRoutes);
router.use("/staff-notifications", staffNotificationsRoutes);
router.use("/housekeeping", housekeepingRoutes);

module.exports = router;
