const { Router } = require("express");
const staffNotificationController = require("../controllers/staffNotification.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireFrontdeskOrAdmin } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

const desk = [authMiddleware, requireFrontdeskOrAdmin];

router.get("/", ...desk, asyncHandler(staffNotificationController.list));
router.patch("/read-all", ...desk, asyncHandler(staffNotificationController.markAllRead));

module.exports = router;
