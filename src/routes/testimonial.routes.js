const { Router } = require("express");
const testimonialController = require("../controllers/testimonial.controller");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", asyncHandler(testimonialController.list));

module.exports = router;
