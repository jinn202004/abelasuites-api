const { Router } = require("express");

const guestController = require("../controllers/guest.controller");

const { authenticate } = require("../middleware/auth");

const asyncHandler = require("../utils/asyncHandler");



const router = Router();



router.get("/me", authenticate, asyncHandler(guestController.getMe));

router.patch("/me", authenticate, asyncHandler(guestController.patchMe));



module.exports = router;


