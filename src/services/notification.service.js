const mongoose = require("mongoose");
const guestNotificationService = require("./guestNotification.service");
const staffNotificationService = require("./staffNotification.service");
const { findOneBookingWithPopulateOrRaw, toPublicBooking } = require("./booking.service");

function isGuestRole(role) {
  return String(role || "").toLowerCase() === "guest";
}

function mapTypeForPublic(type) {
  const t = String(type || "").toLowerCase();
  if (t === "guest_booking_submitted" || t === "booking_review") return "booking_review";
  if (t === "booking_approved") return "booking_approved";
  return t;
}

function toUnifiedNotification(row, userId) {
  const bookingId = row && row.bookingId != null ? String(row.bookingId) : "";
  return {
    id: row && row.id != null ? String(row.id) : "",
    userId: String(userId || ""),
    bookingId,
    type: mapTypeForPublic(row && row.type),
    message: row && row.message ? String(row.message) : "",
    isRead: !!(row && (row.read === true || row.isRead === true)),
    read: !!(row && (row.read === true || row.isRead === true)),
    createdAt: row && row.createdAt ? row.createdAt : null,
    booking: row && row.booking ? row.booking : null,
  };
}

async function attachBookingSnapshots(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];
  return Promise.all(
    notifications.map(async (n) => {
      const bookingId = String(n.bookingId || "");
      if (!mongoose.isValidObjectId(bookingId)) return n;
      const b = await findOneBookingWithPopulateOrRaw(bookingId);
      return { ...n, booking: b ? toPublicBooking(b, { includeIdPhotoData: true }) : null };
    })
  );
}

async function listForUser(user) {
  const uid = String(user && user.id ? user.id : "");
  if (!uid) return { notifications: [], unreadCount: 0 };

  const role = String(user.role || "").toLowerCase();
  if (isGuestRole(role)) {
    const data = await guestNotificationService.listForUser(uid);
    const rows = Array.isArray(data.notifications) ? data.notifications : [];
    const notifications = rows.map((r) => toUnifiedNotification(r, uid));
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    };
  }

  const data = await staffNotificationService.listForUser(uid);
  const rows = Array.isArray(data.notifications) ? data.notifications : [];
  const unified = rows.map((r) => toUnifiedNotification(r, uid));
  const notifications = await attachBookingSnapshots(unified);
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
  };
}

async function markRead(user, notificationId) {
  const uid = String(user && user.id ? user.id : "");
  const role = String(user && user.role ? user.role : "").toLowerCase();
  if (!uid) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }

  if (isGuestRole(role)) {
    const row = await guestNotificationService.markRead(uid, notificationId);
    return toUnifiedNotification(row, uid);
  }

  const row = await staffNotificationService.markRead(uid, notificationId);
  const unified = toUnifiedNotification(row, uid);
  const [enriched] = await attachBookingSnapshots([unified]);
  return enriched || unified;
}

async function markAllRead(user) {
  const uid = String(user && user.id ? user.id : "");
  const role = String(user && user.role ? user.role : "").toLowerCase();
  if (!uid) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  if (isGuestRole(role)) {
    await guestNotificationService.markAllRead(uid);
    return listForUser(user);
  }
  await staffNotificationService.markAllRead(uid);
  return listForUser(user);
}

module.exports = {
  listForUser,
  markRead,
  markAllRead,
};
