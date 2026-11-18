const { Router } = require("express");

const userController = require("../controllers/user.controller");

const guestNotificationController = require("../controllers/guestNotification.controller");

const { authenticate } = require("../middleware/auth");

const asyncHandler = require("../utils/asyncHandler");



const router = Router();



router.get("/me", authenticate, asyncHandler(userController.getMe));

router.patch("/me", authenticate, asyncHandler(userController.updateMe));

router.get("/me/notifications", authenticate, asyncHandler(guestNotificationController.listMine));

router.patch("/me/notifications/read-all", authenticate, asyncHandler(guestNotificationController.markAllRead));

router.patch(

  "/me/notifications/:notificationId/read",

  authenticate,

  asyncHandler(guestNotificationController.markRead)

);

router.patch("/:id", authenticate, asyncHandler(userController.updateUserById)); // add authenticate middleware later

router.get("/:id", asyncHandler(userController.getUser));



module.exports = router;


