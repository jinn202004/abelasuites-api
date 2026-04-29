const { Router } = require("express");
const billingController = require("../controllers/billing.controller");
const { authenticate } = require("../middleware/auth");
const { requireBillingStaff, requireCashierOrAdmin, requireGuestRole } = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get(
  "/my",
  authenticate,
  requireGuestRole,
  asyncHandler(billingController.getMyBilling),
);

router.get("/", authenticate, requireBillingStaff, asyncHandler(billingController.getAllBillingRecords));

router.put(
  "/:id/payment",
  authenticate,
  requireCashierOrAdmin,
  asyncHandler(billingController.updatePayment),
);

router.get("/:id", authenticate, asyncHandler(billingController.getGuestBillingDetails));

module.exports = router;
