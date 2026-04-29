const Review = require("../models/Review");
const { TESTIMONIALS_REQUIRE_APPROVAL } = require("../config");

function normalizeProfilePhotoUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:image/")) return s;
  return "";
}

/**
 * Reviews for public landing / testimonials (newest first).
 * If TESTIMONIALS_REQUIRE_APPROVAL is true, only isApproved reviews; otherwise all stored reviews.
 * @returns {Promise<Array<{ id: string, guestName: string, email: string, rating: number, comment: string, profilePhotoUrl: string, reviewedAt: string | null }>>}
 */
async function getApprovedTestimonials() {
  const filter = TESTIMONIALS_REQUIRE_APPROVAL ? { isApproved: true } : {};
  const rows = await Review.find(filter)
    .populate({ path: "guestId", select: "displayName email profilePhotoData" })
    .populate({ path: "bookingId", select: "customerName email" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return rows.map((r) => {
    const guest = r.guestId && typeof r.guestId === "object" ? r.guestId : null;
    const booking = r.bookingId && typeof r.bookingId === "object" ? r.bookingId : null;
    const guestName =
      String(guest?.displayName || "").trim() ||
      String(booking?.customerName || "").trim() ||
      "Guest";
    const email =
      String(guest?.email || "").trim() ||
      String(booking?.email || "").trim() ||
      "";
    const profilePhotoUrl = normalizeProfilePhotoUrl(guest?.profilePhotoData);
    return {
      id: String(r._id),
      guestName,
      email,
      rating: r.rating,
      comment: r.comment,
      profilePhotoUrl,
      reviewedAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    };
  });
}

module.exports = {
  getApprovedTestimonials,
};
