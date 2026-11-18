const { Router } = require("express");
const eventVenueController = require("../controllers/eventVenue.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
  requireFrontdeskOrAdmin,
  requireHousekeepingFrontdeskOrAdmin,
} = require("../middleware/roleMiddleware");
const { imageUpload } = require("../middleware/imageUpload");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

/** Public catalog — browse event venues without auth (admin CRUD remains protected below). */
router.get("/catalog", asyncHandler(eventVenueController.listCatalog));

/** Catalog read: front desk + housekeeping + admin */
router.get("/", authenticate, requireHousekeepingFrontdeskOrAdmin, asyncHandler(eventVenueController.list));
router.post(
  "/upload",
  authenticate,
  requireAdmin,
  imageUpload.single("image"),
  asyncHandler(eventVenueController.uploadImage)
);
router.patch(
  "/:id/housekeeping-status",
  authenticate,
  requireFrontdeskOrAdmin,
  asyncHandler(eventVenueController.patchHousekeepingStatus)
);
router.get("/:id", authenticate, requireHousekeepingFrontdeskOrAdmin, asyncHandler(eventVenueController.getById));
router.post("/", authenticate, requireAdmin, asyncHandler(eventVenueController.create));
router.patch("/:id", authenticate, requireAdmin, asyncHandler(eventVenueController.update));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(eventVenueController.remove));

module.exports = router;
