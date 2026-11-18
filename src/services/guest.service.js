const mongoose = require("mongoose");
const Guest = require("../models/Guest");
const User = require("../models/User");

const STAFF_ROLES = new Set(["admin", "cashier", "frontdesk", "housekeeping"]);

function accountDisplayNameFromUser(user) {
  if (!user) return "";
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return combined || String(user.name || "").trim();
}

/**
 * Upsert guest profile from booking form data (logged-in user context).
 * Maps legacy body fields: guestId (ID number string), guestIdPhoto* → validId*.
 *
 * Logged-in guests: booking `customerName` / contact fields update the reservation only —
 * they must not overwrite the guest profile (Settings → My Profile).
 */
async function findOrCreateGuestFromBookingBody(actor, body) {
  const email = String(body.email || "").toLowerCase().trim();
  const displayName = String(body.customerName || "").trim();
  const phone = body.contactNumber !== undefined ? String(body.contactNumber).trim() : "";
  const address = body.address !== undefined ? String(body.address).trim() : "";
  /** Legacy `guestId` in POST body is the gov't ID *number*, not the MongoDB Guest FK — ignore empty strings. */
  const legacyIdNumber =
    body.guestId !== undefined && String(body.guestId).trim() !== ""
      ? String(body.guestId).trim()
      : "";
  const validIdNumber =
    body.validIdNumber !== undefined ? String(body.validIdNumber).trim() : legacyIdNumber;
  const validIdPhotoName =
    body.validIdPhotoName !== undefined
      ? String(body.validIdPhotoName)
      : body.guestIdPhotoName !== undefined
        ? String(body.guestIdPhotoName)
        : "";
  const validIdPhotoData =
    body.validIdPhotoData !== undefined
      ? String(body.validIdPhotoData)
      : body.guestIdPhotoData !== undefined
        ? String(body.guestIdPhotoData)
        : "";

  const staff = STAFF_ROLES.has(actor.role);
  const isAccountGuest = !staff && actor.id;

  let guest = null;
  if (!staff) {
    guest = await Guest.findOne({ userId: actor.id });
  }
  if (!guest && email) {
    guest = await Guest.findOne({ email });
  }

  if (guest) {
    if (!guest.userId && isAccountGuest) guest.userId = actor.id;
    if (validIdNumber) guest.validIdNumber = validIdNumber;
    if (validIdPhotoName) guest.validIdPhotoName = validIdPhotoName;
    if (validIdPhotoData) guest.validIdPhotoData = validIdPhotoData;

    /** Walk-in / staff bookings may refresh the linked guest row from the form. */
    if (!isAccountGuest) {
      guest.displayName = displayName || guest.displayName;
      guest.email = email || guest.email;
      guest.phone = phone;
      guest.address = address;
    }

    await guest.save();
    return guest;
  }

  let createDisplayName = displayName;
  let createPhone = phone;
  let createEmail = email;
  let userDoc = null;
  if (isAccountGuest) {
    userDoc = await User.findById(actor.id).select("name firstName lastName phone email").lean();
    const fromUser = accountDisplayNameFromUser(userDoc);
    if (fromUser) createDisplayName = fromUser;
    const userPhone = String(userDoc?.phone || "").trim();
    if (userPhone) createPhone = userPhone;
    const userEmail = String(userDoc?.email || "").trim().toLowerCase();
    if (userEmail) createEmail = userEmail;
  }

  return Guest.create({
    userId: isAccountGuest ? actor.id : null,
    displayName: createDisplayName,
    email: createEmail,
    phone: createPhone,
    address,
    validIdNumber,
    validIdPhotoName,
    validIdPhotoData,
  });
}

function toPublicGuest(g, { includeIdPhotoData = false } = {}) {
  if (!g) return null;
  const o = typeof g.toObject === "function" ? g.toObject() : g;
  return {
    id: o._id,
    userId: o.userId ?? null,
    displayName: o.displayName ?? "",
    email: o.email ?? "",
    phone: o.phone ?? "",
    address: o.address ?? "",
    validIdNumber: o.validIdNumber ?? "",
    validIdPhotoName: o.validIdPhotoName ?? "",
    ...(includeIdPhotoData ? { validIdPhotoData: o.validIdPhotoData ?? "" } : {}),
  };
}

const MAX_PROFILE_PHOTO_CHARS = 600_000;

async function findGuestByUserId(userId) {
  if (!userId) return null;
  if (!mongoose.isValidObjectId(userId)) return null;
  return Guest.findOne({ userId: new mongoose.Types.ObjectId(String(userId)) }).lean();
}

/**
 * Update allowed profile fields for the guest row linked to `userId`.
 * @param {string} userId
 * @param {object} body
 * @returns {Promise<import("mongoose").Document | null>}
 */
async function updateGuestByUserId(userId, body) {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  const uid = new mongoose.Types.ObjectId(String(userId));
  const guest = await Guest.findOne({ userId: uid });
  if (!guest) return null;

  const b = body && typeof body === "object" ? body : {};
  if (b.displayName !== undefined) guest.displayName = String(b.displayName).trim();
  if (b.email !== undefined) guest.email = String(b.email).toLowerCase().trim();
  if (b.phone !== undefined) guest.phone = String(b.phone).trim();
  if (b.address !== undefined) guest.address = String(b.address).trim();
  if (b.profilePhotoData !== undefined) {
    const s = String(b.profilePhotoData);
    if (s.length > MAX_PROFILE_PHOTO_CHARS) {
      throw new Error("Profile photo is too large");
    }
    guest.profilePhotoData = s;
  }

  await guest.save();
  return guest;
}

/**
 * Shape used in billing APIs (aligns with schema fields name / email / contactNumber).
 */
function toBillingGuestShape(guestDoc, bookingFallback = {}) {
  const g = guestDoc && typeof guestDoc === "object" ? guestDoc : {};
  const name =
    String(g.displayName || g.name || "").trim() ||
    String(bookingFallback.customerName || "").trim() ||
    "";
  const email =
    String(g.email || "").trim().toLowerCase() ||
    String(bookingFallback.email || "").trim().toLowerCase() ||
    "";
  const contactNumber =
    String(g.phone || g.contactNumber || "").trim() ||
    String(bookingFallback.contactNumber || "").trim() ||
    "";
  return { name, email, contactNumber };
}

module.exports = {
  findOrCreateGuestFromBookingBody,
  toPublicGuest,
  findGuestByUserId,
  updateGuestByUserId,
  toBillingGuestShape,
};
