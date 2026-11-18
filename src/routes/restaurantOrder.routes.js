const { Router } = require("express");
const restaurantOrderController = require("../controllers/restaurantOrder.controller");
const { authenticate } = require("../middleware/auth");
const {
  requireCashierOrAdmin,
  requireGuestRole,
} = require("../middleware/roleMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

function requireRestaurantOrderReader(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "cashier" || role === "frontdesk" || role === "guest") {
    return next();
  }
  return res.status(403).json({ error: "Access denied" });
}

function requireRestaurantOrderCreator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "cashier" || role === "guest") {
    return next();
  }
  return res.status(403).json({ error: "Cashier, admin, or guest access required" });
}

router.get(
  "/",
  authenticate,
  requireRestaurantOrderReader,
  asyncHandler(restaurantOrderController.list)
);

router.post(
  "/",
  authenticate,
  requireRestaurantOrderCreator,
  asyncHandler(restaurantOrderController.create)
);

router.patch(
  "/:id/payment",
  authenticate,
  requireCashierOrAdmin,
  asyncHandler(restaurantOrderController.patchPayment)
);

router.patch(
  "/:id/status",
  authenticate,
  requireCashierOrAdmin,
  asyncHandler(restaurantOrderController.patchStatus)
);

module.exports = router;
