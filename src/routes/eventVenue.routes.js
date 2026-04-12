const { Router } = require("express");
const eventVenueController = require("../controllers/eventVenue.controller");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(eventVenueController.list));
router.get("/:id", asyncHandler(eventVenueController.getById));
router.post("/", asyncHandler(eventVenueController.create));
router.patch("/:id", asyncHandler(eventVenueController.update));
router.delete("/:id", asyncHandler(eventVenueController.remove));

module.exports = router;
