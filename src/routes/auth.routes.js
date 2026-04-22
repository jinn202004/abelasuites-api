const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/logout", authMiddleware, asyncHandler(authController.logout));

module.exports = router;
