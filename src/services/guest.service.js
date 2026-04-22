const Guest = require("../models/Guest");

const STAFF_ROLES = new Set(["admin", "cashier", "frontdesk", "housekeeping"]);

/**
 * Upsert guest profile from booking form data (logged-in user context).
 * Maps legacy body fields: guestId (ID number string), guestIdPhoto* → validId*.
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

  let guest = null;
  if (!staff) {
    guest = await Guest.findOne({ userId: actor.id });
  }
  if (!guest && email) {
    guest = await Guest.findOne({ email });
  }

  if (guest) {
    guest.displayName = displayName || guest.displayName;
    guest.email = email || guest.email;
    guest.phone = phone;
    guest.address = address;
    if (validIdNumber) guest.validIdNumber = validIdNumber;
    if (validIdPhotoName) guest.validIdPhotoName = validIdPhotoName;
    if (validIdPhotoData) guest.validIdPhotoData = validIdPhotoData;
    if (!guest.userId && !staff && actor.id) guest.userId = actor.id;
    await guest.save();
    return guest;
  }

  return Guest.create({
    userId: staff ? null : actor.id,
    displayName,
    email,
    phone,
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

module.exports = {
  findOrCreateGuestFromBookingBody,
  toPublicGuest,
};
