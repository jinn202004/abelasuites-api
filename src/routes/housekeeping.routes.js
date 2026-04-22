const { Router } = require("express");
const housekeepingController = require("../controllers/housekeeping.controller");
const housekeepingNotificationController = require("../controllers/housekeepingNotification.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireHousekeepingOrAdmin } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

const hk = [authMiddleware, requireHousekeepingOrAdmin];

router.get("/notifications", ...hk, asyncHandler(housekeepingNotificationController.list));
router.patch("/notifications/read-all", ...hk, asyncHandler(housekeepingNotificationController.markAllRead));

router.get("/tasks", ...hk, asyncHandler(housekeepingController.getTasks));
router.post("/reconcile-missing", ...hk, asyncHandler(housekeepingController.reconcileMissing));
router.put("/:id/status", ...hk, asyncHandler(housekeepingController.updateTaskStatus));

module.exports = router;
