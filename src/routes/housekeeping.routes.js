const { Router } = require("express");
const housekeepingController = require("../controllers/housekeeping.controller");
const housekeepingNotificationController = require("../controllers/housekeepingNotification.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const {
  requireHousekeepingOrAdmin,
  requireHousekeepingFrontdeskOrAdmin,
} = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

const hk = [authMiddleware, requireHousekeepingOrAdmin];
/** Read-only task list for front desk dashboard + housekeeping + admin */
const hkRead = [authMiddleware, requireHousekeepingFrontdeskOrAdmin];

router.get("/notifications", ...hk, asyncHandler(housekeepingNotificationController.list));
router.patch("/notifications/read-all", ...hk, asyncHandler(housekeepingNotificationController.markAllRead));

router.get(
  "/recent-cleaning",
  authMiddleware,
  requireHousekeepingFrontdeskOrAdmin,
  asyncHandler(housekeepingController.getRecentCleaning)
);

router.get("/tasks", ...hkRead, asyncHandler(housekeepingController.getTasks));
router.post("/reconcile-missing", ...hk, asyncHandler(housekeepingController.reconcileMissing));
router.put("/:id/status", ...hk, asyncHandler(housekeepingController.updateTaskStatus));

module.exports = router;
