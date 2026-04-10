const { Router } = require("express");
const userController = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/me", authenticate, asyncHandler(userController.getMe));
router.patch("/me", authenticate, asyncHandler(userController.updateMe));
router.patch("/:id", authenticate, asyncHandler(userController.updateUserById)); // add authenticate middleware later
router.get("/:id", asyncHandler(userController.getUser));

module.exports = router;
