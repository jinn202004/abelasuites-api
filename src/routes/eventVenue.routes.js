const { Router } = require("express");
const eventVenueController = require("../controllers/eventVenue.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
  requireHousekeepingOrAdmin,
  requireHousekeepingFrontdeskOrAdmin,
} = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

/** Catalog read: front desk + housekeeping + admin */
router.get("/", authenticate, requireHousekeepingFrontdeskOrAdmin, asyncHandler(eventVenueController.list));
router.get("/:id", authenticate, requireHousekeepingFrontdeskOrAdmin, asyncHandler(eventVenueController.getById));
router.post("/", authenticate, requireAdmin, asyncHandler(eventVenueController.create));
router.patch("/:id", authenticate, requireAdmin, asyncHandler(eventVenueController.update));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(eventVenueController.remove));

module.exports = router;
