const { Router } = require("express");
const bookingController = require("../controllers/booking.controller");
const bookingApprovalRoutes = require("./bookingApproval.routes");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(bookingApprovalRoutes);

router.get("/event-calendar", asyncHandler(bookingController.eventCalendar));
router.get("/", authenticate, asyncHandler(bookingController.list));
router.get("/:id", authenticate, asyncHandler(bookingController.getById));
router.post("/", authenticate, asyncHandler(bookingController.create));
router.patch("/:id", authenticate, asyncHandler(bookingController.update));
router.delete("/:id", authenticate, asyncHandler(bookingController.remove));

module.exports = router;
