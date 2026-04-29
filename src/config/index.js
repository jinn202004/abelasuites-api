const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
});

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * When true, new guest reviews appear on GET /api/testimonials immediately.
 * Default is true when env is unset so testimonials populate without a separate approval step.
 * Set AUTO_APPROVE_REVIEWS=false to require staff approval before reviews are public.
 */
function envBool(name, whenUnset) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return whenUnset;
  const s = String(raw).toLowerCase().trim();
  if (["0", "false", "no", "off"].includes(s)) return false;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  return whenUnset;
}

const AUTO_APPROVE_REVIEWS = envBool("AUTO_APPROVE_REVIEWS", true);

/**
 * When true, GET /api/testimonials only returns reviews with isApproved: true.
 * Default false so guest reviews show even if they were created before auto-approve or while moderation was on.
 * Set TESTIMONIALS_REQUIRE_APPROVAL=true for a public page that hides pending reviews.
 */
const TESTIMONIALS_REQUIRE_APPROVAL = envBool("TESTIMONIALS_REQUIRE_APPROVAL", false);

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  AUTO_APPROVE_REVIEWS,
  TESTIMONIALS_REQUIRE_APPROVAL,
};
