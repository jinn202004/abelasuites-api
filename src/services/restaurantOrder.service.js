const mongoose = require("mongoose");
const { RestaurantOrder } = require("../models/RestaurantOrder");
const { MenuItem } = require("../models/MenuItem");
const Booking = require("../models/Booking");
const Guest = require("../models/Guest");
const User = require("../models/User");
const guestService = require("./guest.service");

const ACTIVE_ROOM_BOOKING_STATUSES = ["occupied", "approved", "confirmed", "pending"];
const FALLBACK_ROOM_BOOKING_STATUSES = [
  "occupied",
  "approved",
  "confirmed",
  "pending",
  "completed",
];
const VALID_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready", "completed", "cancelled"];

const SERVICE_FEE_RATE = Number(process.env.RESTAURANT_SERVICE_FEE_RATE || 0);
const VAT_RATE = Number(process.env.RESTAURANT_VAT_RATE || 0);

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizePaymentMethod(raw) {
  const method = String(raw || "").trim().toLowerCase();
  return method === "gcash" ? "gcash" : method === "cash" ? "cash" : "";
}

function normalizePaymentProofData(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.length > 500_000) {
    const err = new Error("Payment proof image is too large");
    err.status = 400;
    throw err;
  }
  if (!s.startsWith("data:image/") && !/^https?:\/\//i.test(s)) {
    const err = new Error("paymentProofData must be an image data URL or https URL");
    err.status = 400;
    throw err;
  }
  return s;
}

function extractGuestGcashPayment(body, totalAmount) {
  const transactionId = String(body?.transactionId || "").trim();
  const paymentDate = String(body?.paymentDate || "").trim();
  const paymentProofData = normalizePaymentProofData(body?.paymentProofData);
  const paymentProofName = String(body?.paymentProofName || "").trim() || "uploaded";
  const amountPaid = roundMoney(body?.amountPaid ?? totalAmount);

  if (!transactionId) {
    const err = new Error("transactionId is required for GCash orders");
    err.status = 400;
    throw err;
  }
  if (!paymentDate) {
    const err = new Error("paymentDate is required for GCash orders");
    err.status = 400;
    throw err;
  }
  if (!paymentProofData) {
    const err = new Error("paymentProofData is required for GCash orders");
    err.status = 400;
    throw err;
  }
  if (totalAmount > 0 && amountPaid + 1e-6 < totalAmount) {
    const err = new Error("amountPaid must be at least the order total for GCash");
    err.status = 400;
    throw err;
  }

  return {
    transactionId,
    paymentDate,
    paymentProofData,
    paymentProofName,
    amountPaid: totalAmount > 0 ? Math.min(amountPaid, totalAmount) : amountPaid,
  };
}

function accountNameFromUser(user) {
  if (!user || typeof user !== "object") return "";
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return combined || String(user.name || "").trim();
}

/** Guest name for cashier orders — guest profile displayName, else linked user account name. */
async function resolveGuestAccountName(guestDoc, userId) {
  const profileName = String(guestDoc?.displayName || guestDoc?.name || "").trim();
  if (profileName) return profileName;

  const uid =
    userId && mongoose.isValidObjectId(userId)
      ? String(userId)
      : guestDoc?.userId
        ? String(guestDoc.userId)
        : "";
  if (uid) {
    const user = await User.findById(uid).select("firstName lastName name email").lean();
    const accountName = accountNameFromUser(user);
    if (accountName) return accountName;
    const email = String(user?.email || guestDoc?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
  }

  const email = String(guestDoc?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "";
}

function toPublicGuest(doc, bookingContext = null, guestName = "") {
  if (!doc) return null;
  const shape = guestService.toBillingGuestShape(doc);
  const name = String(guestName || shape.name || "").trim();
  return {
    id: String(doc._id),
    displayName: String(doc.displayName || "").trim(),
    name,
    email: shape.email,
    phone: shape.contactNumber || "",
    roomNumber: bookingContext?.roomNumber || "",
    bookingId: bookingContext?.bookingId || "",
  };
}

async function resolveGuestBookingContext(guestId, userId) {
  const or = [];
  if (guestId && mongoose.isValidObjectId(guestId)) {
    or.push({ guestId: new mongoose.Types.ObjectId(String(guestId)) });
  }
  if (userId && mongoose.isValidObjectId(userId)) {
    or.push({ userId: new mongoose.Types.ObjectId(String(userId)) });
  }
  if (!or.length) return null;

  const baseQuery = { $or: or, type: "room" };

  for (const status of ACTIVE_ROOM_BOOKING_STATUSES) {
    const booking = await Booking.findOne({ ...baseQuery, status })
      .sort({ updatedAt: -1 })
      .select("_id roomNumber contactNumber status")
      .lean();
    const roomNumber = String(booking?.roomNumber || "").trim();
    if (booking && roomNumber) {
      return {
        bookingId: String(booking._id),
        roomNumber,
        contactNumber: String(booking.contactNumber || "").trim(),
      };
    }
  }

  const fallback = await Booking.findOne({
    ...baseQuery,
    status: { $in: FALLBACK_ROOM_BOOKING_STATUSES },
    roomNumber: { $nin: ["", null] },
  })
    .sort({ updatedAt: -1 })
    .select("_id roomNumber contactNumber status")
    .lean();

  if (!fallback) return null;
  const roomNumber = String(fallback.roomNumber || "").trim();
  if (!roomNumber) return null;
  return {
    bookingId: String(fallback._id),
    roomNumber,
    contactNumber: String(fallback.contactNumber || "").trim(),
  };
}

async function resolveGuestPhone(guestDoc, userId, bookingContext = null) {
  const shape = guestService.toBillingGuestShape(guestDoc);
  let phone = String(shape.contactNumber || "").trim();
  if (!phone && bookingContext?.contactNumber) {
    phone = String(bookingContext.contactNumber).trim();
  }
  if (!phone && userId && mongoose.isValidObjectId(userId)) {
    const user = await User.findById(userId).select("phone").lean();
    phone = String(user?.phone || "").trim();
  }
  return phone;
}

async function resolveGuestOrderMeta({ guestId, userId, guestDoc, body }) {
  const bookingContext = await resolveGuestBookingContext(guestId, userId);
  const roomNumber =
    String(body?.roomNumber || "").trim() ||
    String(bookingContext?.roomNumber || "").trim();
  const guestPhone =
    String(body?.contactNumber || body?.guestPhone || "").trim() ||
    (await resolveGuestPhone(guestDoc, userId, bookingContext));
  const bookingId =
    String(body?.bookingId || "").trim() ||
    String(bookingContext?.bookingId || "").trim();

  return {
    roomNumber,
    guestPhone,
    bookingId: bookingId && mongoose.isValidObjectId(bookingId) ? bookingId : "",
  };
}

async function shapePopulatedOrder(doc) {
  if (!doc) return null;
  const gid =
    doc?.guestId && typeof doc.guestId === "object"
      ? String(doc.guestId._id)
      : doc?.guestId
        ? String(doc.guestId)
        : "";
  const uid = doc?.userId ? String(doc.userId) : "";
  const needsLookup = !String(doc.roomNumber || "").trim() || !String(doc.guestPhone || "").trim();
  const bookingContext = needsLookup ? await resolveGuestBookingContext(gid, uid) : null;
  const order = await enrichPublicOrder(doc, bookingContext);
  const rows = await attachMenuItemImages([order]);
  return rows[0];
}

async function enrichPublicOrder(doc, bookingContext = null) {
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const guestDoc = o.guestId && typeof o.guestId === "object" ? o.guestId : null;
  const gid = guestDoc ? String(guestDoc._id) : o.guestId ? String(o.guestId) : "";
  const uid = o.userId ? String(o.userId) : "";

  const storedRoom = String(o.roomNumber || "").trim();
  const storedPhone = String(o.guestPhone || "").trim();
  const storedBookingId = o.bookingId ? String(o.bookingId._id ?? o.bookingId) : "";

  const ctx = {
    roomNumber: storedRoom || bookingContext?.roomNumber || "",
    bookingId: storedBookingId || bookingContext?.bookingId || "",
  };
  const guest = guestDoc ? toPublicGuest(guestDoc, ctx) : null;
  const guestPhone =
    storedPhone ||
    (guest ? String(guest.phone || "").trim() : "") ||
    (await resolveGuestPhone(guestDoc, uid, bookingContext));
  const guestName = await resolveGuestAccountName(guestDoc, uid);

  return toPublicOrder(o, {
    ...ctx,
    contactNumber: guestPhone,
    guestPhone,
    guestName,
  });
}

function toPublicOrder(doc, context = null) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const guestDoc = o.guestId && typeof o.guestId === "object" ? o.guestId : null;
  const resolvedGuestName = String(context?.guestName || "").trim();
  const guest = guestDoc
    ? toPublicGuest(
        guestDoc,
        {
          roomNumber: context?.roomNumber || "",
          bookingId: context?.bookingId || "",
        },
        resolvedGuestName
      )
    : null;

  const guestPhone =
    String(context?.guestPhone || context?.contactNumber || "").trim() ||
    String(o.guestPhone || "").trim() ||
    String(guest?.phone || "").trim();
  const roomNumber =
    String(o.roomNumber || "").trim() ||
    String(context?.roomNumber || "").trim() ||
    String(guest?.roomNumber || "").trim();
  const bookingId =
    (o.bookingId ? String(o.bookingId._id ?? o.bookingId) : "") ||
    String(context?.bookingId || "").trim() ||
    String(guest?.bookingId || "").trim();
  const guestName = resolvedGuestName || guest?.name || "";

  return {
    id: String(o._id),
    guestId: guestDoc ? String(guestDoc._id ?? o.guestId) : o.guestId ? String(o.guestId) : undefined,
    userId: o.userId ? String(o.userId) : undefined,
    guest: guest
      ? {
          ...guest,
          name: guestName,
          phone: guestPhone,
          roomNumber,
          bookingId: bookingId || guest.bookingId || "",
        }
      : undefined,
    guestName,
    guestPhone,
    roomNumber,
    bookingId,
    source: o.source || "pos",
    items: Array.isArray(o.items)
      ? o.items.map((line) => ({
          menuItemId: line.menuItemId ? String(line.menuItemId) : undefined,
          menuItemName: line.menuItemName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          price: line.unitPrice,
          specialInstructions: line.specialInstructions || "",
          imageUrl: line.imageUrl || "",
        }))
      : [],
    subtotal: o.subtotal ?? 0,
    serviceCharge: o.serviceCharge ?? 0,
    taxAmount: o.taxAmount ?? 0,
    totalAmount: o.totalAmount ?? 0,
    amountPaid: o.amountPaid ?? 0,
    paymentMethod: o.paymentMethod || "",
    transactionId: o.transactionId || "",
    paymentDate: o.paymentDate || "",
    paymentProofData: o.paymentProofData || "",
    paymentProofName: o.paymentProofName || "",
    status: o.status || "pending",
    orderDate: o.orderDate || o.createdAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function attachMenuItemImages(orders) {
  const menuIds = new Set();
  for (const o of orders) {
    for (const line of o.items || []) {
      const mid = line?.menuItemId;
      if (mid && mongoose.isValidObjectId(mid)) menuIds.add(String(mid));
    }
  }
  if (!menuIds.size) return orders;

  const rows = await MenuItem.find({ _id: { $in: [...menuIds] } })
    .select("imageUrl")
    .lean();
  const imageById = new Map(rows.map((r) => [String(r._id), String(r.imageUrl || "").trim()]));

  return orders.map((o) => ({
    ...o,
    items: (o.items || []).map((line) => ({
      ...line,
      imageUrl: imageById.get(String(line.menuItemId)) || "",
    })),
  }));
}

function normalizeItemsInput(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items must be a non-empty array");
    err.status = 400;
    throw err;
  }
  return items.map((line, idx) => {
    const menuItemId = String(line?.menuItemId || "").trim();
    const quantity = parseInt(String(line?.quantity ?? 1), 10);
    if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) {
      const err = new Error(`items[${idx}].menuItemId is invalid`);
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      const err = new Error(`items[${idx}].quantity must be at least 1`);
      err.status = 400;
      throw err;
    }
    return {
      menuItemId,
      quantity,
      specialInstructions: String(line?.specialInstructions || "").trim(),
    };
  });
}

async function resolveMenuLines(items, { requireAvailable = false } = {}) {
  const ids = items.map((i) => i.menuItemId);
  const menuRows = await MenuItem.find({ _id: { $in: ids } }).lean();
  const byId = new Map(menuRows.map((r) => [String(r._id), r]));

  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const row = byId.get(item.menuItemId);
    if (!row) {
      const err = new Error(`Menu item not found: ${item.menuItemId}`);
      err.status = 400;
      throw err;
    }
    const availability = String(row.availability ?? row.status ?? "available").toLowerCase();
    if (requireAvailable && availability !== "available") {
      const err = new Error(`${row.name} is currently unavailable`);
      err.status = 400;
      throw err;
    }
    const unitPrice = roundMoney(row.price);
    const lineTotal = roundMoney(unitPrice * item.quantity);
    subtotal = roundMoney(subtotal + lineTotal);
    lines.push({
      menuItemId: row._id,
      menuItemName: row.name,
      quantity: item.quantity,
      unitPrice,
      specialInstructions: item.specialInstructions,
    });
  }

  const serviceCharge =
    SERVICE_FEE_RATE > 0 ? roundMoney(subtotal * SERVICE_FEE_RATE) : 0;
  const taxable = roundMoney(subtotal + serviceCharge);
  const taxAmount = VAT_RATE > 0 ? roundMoney(taxable * VAT_RATE) : 0;
  const totalAmount = roundMoney(taxable + taxAmount);

  return { lines, subtotal, serviceCharge, taxAmount, totalAmount };
}

async function resolveGuestForActor(actor) {
  if (!actor?.id) return { guest: null, userId: null };
  const user = await User.findById(actor.id).select("firstName lastName name email phone").lean();
  let guest = await guestService.findGuestByUserId(actor.id);
  if (guest) {
    const accountName = accountNameFromUser(user);
    if (accountName && !String(guest.displayName || "").trim()) {
      await Guest.updateOne({ _id: guest._id }, { $set: { displayName: accountName } });
      guest = { ...guest, displayName: accountName };
    }
    return { guest, userId: actor.id };
  }
  if (!user) return { guest: null, userId: actor.id };
  const created = await Guest.create({
    userId: actor.id,
    displayName: accountNameFromUser(user) || "",
    email: user.email || "",
    phone: String(user.phone || "").trim(),
  });
  return { guest: created, userId: actor.id };
}

async function list(filters = {}) {
  const query = {};
  const guestId = String(filters.guestId || "").trim();
  const status = String(filters.status || "").trim().toLowerCase();
  const source = String(filters.source || "").trim().toLowerCase();

  if (guestId && mongoose.isValidObjectId(guestId)) {
    query.guestId = guestId;
  }
  if (status && VALID_ORDER_STATUSES.includes(status)) {
    query.status = status;
  }
  if (source === "guest" || source === "pos") {
    query.source = source;
  }

  const rows = await RestaurantOrder.find(query)
    .populate("guestId")
    .sort({ createdAt: -1 })
    .limit(Math.min(500, parseInt(String(filters.limit || 200), 10) || 200))
    .lean();

  const shaped = [];
  for (const r of rows) {
    const guestDoc = r.guestId;
    const gid =
      guestDoc && typeof guestDoc === "object" && guestDoc._id
        ? String(guestDoc._id)
        : guestDoc
          ? String(guestDoc)
          : "";
    const uid = r.userId ? String(r.userId) : "";
    const shapedRow = { ...r, guestId: guestDoc?._id ?? r.guestId };
    if (guestDoc && typeof guestDoc === "object") {
      shapedRow.guestId = guestDoc;
    }
    shaped.push(await enrichPublicOrder(shapedRow, await resolveGuestBookingContext(gid, uid)));
  }

  return attachMenuItemImages(shaped);
}

async function createFromActor(actor, body, { source = "pos" } = {}) {
  const items = normalizeItemsInput(body?.items);
  const isGuestSource = source === "guest";
  const pricing = await resolveMenuLines(items, { requireAvailable: isGuestSource });

  let guestId;
  let userId;
  if (isGuestSource) {
    const resolved = await resolveGuestForActor(actor);
    if (!resolved.guest) {
      const err = new Error("Guest profile required to place a restaurant order");
      err.status = 400;
      throw err;
    }
    guestId = resolved.guest._id;
    userId = resolved.userId;
  } else if (actor?.id) {
    userId = actor.id;
    const guest = await guestService.findGuestByUserId(actor.id);
    if (guest) guestId = guest._id;
  }

  let totalAmount = pricing.totalAmount;
  if (!isGuestSource && body?.totalAmount != null) {
    const clientTotal = roundMoney(body.totalAmount);
    if (clientTotal >= 0) totalAmount = clientTotal;
  }

  const paymentMethod = normalizePaymentMethod(body?.paymentMethod);
  let amountPaid = 0;
  let transactionId = "";
  let paymentDate = "";
  let paymentProofData = "";
  let paymentProofName = "";

  if (isGuestSource && paymentMethod === "gcash") {
    const gcash = extractGuestGcashPayment(body, totalAmount);
    amountPaid = gcash.amountPaid;
    transactionId = gcash.transactionId;
    paymentDate = gcash.paymentDate;
    paymentProofData = gcash.paymentProofData;
    paymentProofName = gcash.paymentProofName;
  }

  let roomNumber = "";
  let guestPhone = "";
  let bookingId = null;
  if (isGuestSource) {
    const guestDoc = await Guest.findById(guestId).lean();
    const meta = await resolveGuestOrderMeta({
      guestId: String(guestId),
      userId,
      guestDoc,
      body,
    });
    roomNumber = meta.roomNumber;
    guestPhone = meta.guestPhone;
    bookingId = meta.bookingId || null;
  }

  const doc = await RestaurantOrder.create({
    guestId,
    userId,
    source,
    items: pricing.lines,
    subtotal: pricing.subtotal,
    serviceCharge: pricing.serviceCharge,
    taxAmount: pricing.taxAmount,
    totalAmount,
    amountPaid,
    paymentMethod,
    transactionId,
    paymentDate,
    paymentProofData,
    paymentProofName,
    roomNumber,
    guestPhone,
    bookingId,
    status: isGuestSource ? "pending" : "pending",
    orderDate: new Date(),
  });

  const populated = await RestaurantOrder.findById(doc._id).populate("guestId").lean();
  return shapePopulatedOrder(populated);
}

async function patchPayment(orderId, body) {
  if (!mongoose.isValidObjectId(orderId)) {
    const err = new Error("Invalid order id");
    err.status = 400;
    throw err;
  }

  const amountPaid = roundMoney(body?.amountPaid);
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    const err = new Error("amountPaid must be a non-negative number");
    err.status = 400;
    throw err;
  }

  const paymentMethod = normalizePaymentMethod(body?.paymentMethod);

  const doc = await RestaurantOrder.findByIdAndUpdate(
    orderId,
    { amountPaid, paymentMethod },
    { new: true, runValidators: true }
  )
    .populate("guestId")
    .lean();

  if (!doc) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  return shapePopulatedOrder(doc);
}

async function patchStatus(orderId, status) {
  if (!mongoose.isValidObjectId(orderId)) {
    const err = new Error("Invalid order id");
    err.status = 400;
    throw err;
  }

  const normalized = String(status || "").trim().toLowerCase();
  if (!VALID_ORDER_STATUSES.includes(normalized)) {
    const err = new Error(
      "status must be pending, accepted, preparing, ready, completed, or cancelled"
    );
    err.status = 400;
    throw err;
  }

  const doc = await RestaurantOrder.findByIdAndUpdate(
    orderId,
    { status: normalized },
    { new: true, runValidators: true }
  )
    .populate("guestId")
    .lean();

  if (!doc) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  return shapePopulatedOrder(doc);
}

module.exports = {
  list,
  createFromActor,
  patchPayment,
  patchStatus,
  toPublicOrder,
};
