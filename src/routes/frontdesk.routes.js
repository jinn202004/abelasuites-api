const { Router } = require("express");
const frontdeskController = require("../controllers/frontdesk.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireFrontdeskOrAdmin } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get(
  "/summary",
  authMiddleware,
  requireFrontdeskOrAdmin,
  asyncHandler(frontdeskController.getDashboardSummary)
);

router.get(
  "/bookings/:id",
  authMiddleware,
  requireFrontdeskOrAdmin,
  asyncHandler(frontdeskController.getFrontdeskBookingDetails)
);

module.exports = router;
