const { Router } = require("express");
const reviewController = require("../controllers/review.controller");
const { authenticate } = require("../middleware/auth");
const { requireBillingStaff, requireGuestRole } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.post("/", authenticate, requireGuestRole, asyncHandler(reviewController.create));
router.get("/me", authenticate, requireGuestRole, asyncHandler(reviewController.listMine));
router.get("/", authenticate, requireBillingStaff, asyncHandler(reviewController.listAll));
router.put("/:id/approve", authenticate, requireBillingStaff, asyncHandler(reviewController.approve));

module.exports = router;
