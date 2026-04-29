const { Router } = require("express");
const notificationController = require("../controllers/notification.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", authMiddleware, asyncHandler(notificationController.listMine));
router.put("/read-all", authMiddleware, asyncHandler(notificationController.markAllRead));
router.put("/:id/read", authMiddleware, asyncHandler(notificationController.markRead));

module.exports = router;
