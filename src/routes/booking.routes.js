const { Router } = require("express");
const bookingController = require("../controllers/booking.controller");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(bookingController.list));
router.get("/:id", asyncHandler(bookingController.getById));
router.post("/", asyncHandler(bookingController.create));
router.patch("/:id", asyncHandler(bookingController.update));
router.delete("/:id", asyncHandler(bookingController.remove));

module.exports = router;
