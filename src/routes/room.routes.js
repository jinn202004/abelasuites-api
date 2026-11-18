const { Router } = require("express");
const roomController = require("../controllers/room.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { requireFrontdeskOrAdmin } = require("../middleware/roleMiddleware");
const { imageUpload } = require("../middleware/imageUpload");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Public catalog — browse rooms without auth (create/update/delete remain admin-only).
router.get("/", asyncHandler(roomController.list));
router.get("/:id", asyncHandler(roomController.getById));

router.patch(
  "/:id/housekeeping-status",
  authenticate,
  requireFrontdeskOrAdmin,
  asyncHandler(roomController.patchHousekeepingStatus)
);

router.use(authenticate, requireAdmin);

router.post("/upload", imageUpload.single("image"), asyncHandler(roomController.uploadImage));
router.post("/", asyncHandler(roomController.create));
router.patch("/:id", asyncHandler(roomController.update));
router.delete("/:id", asyncHandler(roomController.remove));

module.exports = router;
