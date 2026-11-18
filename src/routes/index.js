const { Router } = require("express");

const healthRoutes = require("./health.routes");

const authRoutes = require("./auth.routes");

const userRoutes = require("./user.routes");

const roomRoutes = require("./room.routes");

const eventVenueRoutes = require("./eventVenue.routes");

const bookingRoutes = require("./booking.routes");

const staffRoutes = require("./staff.routes");

const staffNotificationsRoutes = require("./staffNotifications.routes");

const notificationRoutes = require("./notification.routes");

const housekeepingRoutes = require("./housekeeping.routes");

const billingRoutes = require("./billing.routes");

const guestRoutes = require("./guest.routes");

const frontdeskRoutes = require("./frontdesk.routes");

const reviewRoutes = require("./review.routes");

const testimonialRoutes = require("./testimonial.routes");

const categoryRoutes = require("./category.routes");

const menuRoutes = require("./menu.routes");

const restaurantOrderRoutes = require("./restaurantOrder.routes");



const router = Router();



router.use("/health", healthRoutes);

router.use("/auth", authRoutes);

router.use("/users", userRoutes);

router.use("/rooms", roomRoutes);

router.use("/event-venues", eventVenueRoutes);

router.use("/bookings", bookingRoutes);

router.use("/staff", staffRoutes);

router.use("/staff-notifications", staffNotificationsRoutes);

router.use("/notifications", notificationRoutes);

router.use("/housekeeping", housekeepingRoutes);

router.use("/billing", billingRoutes);

router.use("/guests", guestRoutes);

router.use("/frontdesk", frontdeskRoutes);

router.use("/reviews", reviewRoutes);

router.use("/testimonials", testimonialRoutes);

router.use("/categories", categoryRoutes);

router.use("/menu", menuRoutes);

router.use("/restaurant-orders", restaurantOrderRoutes);



module.exports = router;


