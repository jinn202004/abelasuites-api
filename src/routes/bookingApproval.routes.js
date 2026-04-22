const { Router } = require("express");
const bookingApprovalController = require("../controllers/bookingApproval.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireFrontdeskOrAdmin } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

const desk = [authMiddleware, requireFrontdeskOrAdmin];

router.get("/pending", ...desk, asyncHandler(bookingApprovalController.getPendingBookingsWithGuest));
router.get("/history", ...desk, asyncHandler(bookingApprovalController.getBookingHistoryWithGuest));
router.put("/:id/approve", ...desk, asyncHandler(bookingApprovalController.approveBooking));
router.put("/:id/reject", ...desk, asyncHandler(bookingApprovalController.rejectBooking));

module.exports = router;
