const { Router } = require("express");
const roomController = require("../controllers/room.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Public catalog — browse rooms without auth (create/update/delete remain admin-only).
router.get("/", asyncHandler(roomController.list));
router.get("/:id", asyncHandler(roomController.getById));

router.use(authenticate, requireAdmin);

router.post("/", asyncHandler(roomController.create));
router.patch("/:id", asyncHandler(roomController.update));
router.delete("/:id", asyncHandler(roomController.remove));

module.exports = router;
