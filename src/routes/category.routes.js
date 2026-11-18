const { Router } = require("express");
const menuCategoryController = require("../controllers/menuCategory.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { requireCashierOrAdmin } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", authenticate, requireCashierOrAdmin, asyncHandler(menuCategoryController.list));

router.use(authenticate, requireAdmin);

router.post("/", asyncHandler(menuCategoryController.create));
router.put("/:id", asyncHandler(menuCategoryController.update));
router.delete("/:id", asyncHandler(menuCategoryController.remove));

module.exports = router;
