const { Router } = require("express");
const staffController = require("../controllers/staff.controller");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.post("/", asyncHandler(staffController.create));
router.get("/", asyncHandler(staffController.list));
router.put("/:id", asyncHandler(staffController.update));
router.delete("/:id", asyncHandler(staffController.remove));

module.exports = router;
