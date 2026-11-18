const { Router } = require("express");
const menuController = require("../controllers/menu.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { requireCashierOrAdmin, requireGuestRole } = require("../middleware/roleMiddleware");
const { imageUpload } = require("../middleware/imageUpload");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/catalog", asyncHandler(menuController.catalog));

router.get(
  "/guest-portal",
  authenticate,
  requireGuestRole,
  asyncHandler(menuController.guestPortal)
);

router.get(
  "/admin-bootstrap",
  authenticate,
  requireAdmin,
  asyncHandler(menuController.adminBootstrap)
);

router.get("/", authenticate, requireCashierOrAdmin, asyncHandler(menuController.list));
router.get("/:id", authenticate, requireCashierOrAdmin, asyncHandler(menuController.getById));

router.use(authenticate, requireAdmin);

router.post("/upload", imageUpload.single("image"), asyncHandler(menuController.uploadImage));
router.post("/", asyncHandler(menuController.create));
router.put("/:id", asyncHandler(menuController.update));
router.delete("/:id", asyncHandler(menuController.remove));

module.exports = router;
