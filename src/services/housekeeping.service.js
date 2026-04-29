const mongoose = require("mongoose");
const HousekeepingTask = require("../models/HousekeepingTask");
const Room = require("../models/Room");
const EventVenue = require("../models/EventVenue");
const housekeepingNotificationService = require("./housekeepingNotification.service");
const staffNotificationService = require("./staffNotification.service");

function buildNewCleaningTaskMessage(fresh, inferredType) {
  const guest = String(fresh.customerName || "").trim() || "Guest";
  if (inferredType === "room") {
    const label = String(fresh.roomTitle || "").trim() || "Room";
    return `New cleaning task: ${label} — ${guest}.`;
  }
  const venue = String(fresh.venueName || fresh.eventTitle || "Event venue").trim();
  return `New cleaning task: ${venue} — ${guest}.`;
}

/** @param {object} lean — populated HousekeepingTask lean doc */
function buildCleaningCompletedMessage(lean) {
  const b = lean.bookingId && typeof lean.bookingId === "object" && lean.bookingId._id ? lean.bookingId : null;
  const guest = String(b?.customerName || "").trim() || "Guest";
  if (lean.targetType === "room") {
    const room = lean.roomId && typeof lean.roomId === "object" && lean.roomId._id ? lean.roomId : null;
    const num = room?.roomNumber != null ? String(room.roomNumber).trim() : "";
    const title = String(room?.title || b?.roomTitle || "Room").trim();
    const place = num ? `Room ${num}` : title;
    return `Housekeeping finished: ${place} (${title}) is ready for guests — ${guest}.`;
  }
  const venue = lean.eventVenueId && typeof lean.eventVenueId === "object" && lean.eventVenueId._id ? lean.eventVenueId : null;
  const name = String(venue?.name || b?.venueName || b?.eventTitle || "Event venue").trim();
  const evNum = venue?.eventNum != null ? String(venue.eventNum).trim() : "";
  const suffix = evNum ? ` (${evNum})` : "";
  return `Housekeeping finished: ${name}${suffix} is ready for the next booking.`;
}

function oid(id) {
  if (id == null) return null;
  const s = String(id).trim();
  return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : null;
}

/**
 * After a booking is approved: flag the related room or event venue for cleaning and create a task.
 * Idempotent per booking via unique `bookingId` on HousekeepingTask.
 * @param {object} fresh — lean booking from `findOneBookingWithPopulateOrRaw` (has `_id`, `type`, `roomId`, `eventVenueId`)
 */
async function triggerAfterBookingApproved(fresh) {
  if (!fresh) return;
  const bookingId = fresh._id;
  if (!bookingId) return;

  let type = String(fresh.type || "")
    .trim()
    .toLowerCase();
  /** Legacy / raw rows may omit `type`; infer so a cleaning task is still created. */
  if (type !== "room" && type !== "event") {
    const hasRoom = fresh.roomId != null && String(fresh.roomId).trim() && oid(fresh.roomId);
    const hasVenue = fresh.eventVenueId != null && String(fresh.eventVenueId).trim() && oid(fresh.eventVenueId);
    if (hasRoom && !hasVenue) type = "room";
    else if (hasVenue) type = "event";
    else type = "";
  }

  try {
    if (type === "room") {
      const rid = oid(fresh.roomId);
      if (rid) {
        await Room.updateOne(
          { _id: rid },
          { $set: { status: "needs_cleaning", updatedAt: new Date() } }
        );
      }
      const taskDoc = await HousekeepingTask.create({
        type: "cleaning_request",
        status: "pending",
        bookingId,
        targetType: "room",
        roomId: rid,
        eventVenueId: null,
      });
      try {
        await housekeepingNotificationService.createCleaningTaskNew(
          taskDoc._id,
          bookingId,
          buildNewCleaningTaskMessage(fresh, "room")
        );
      } catch (err) {
        console.warn("[housekeeping] HK notification (new task):", err.message);
      }
      return;
    }

    if (type === "event") {
      const vid = oid(fresh.eventVenueId);
      if (vid) {
        await EventVenue.updateOne(
          { _id: vid },
          { $set: { status: "needs_cleaning", updatedAt: new Date() } }
        );
      }
      const taskDoc = await HousekeepingTask.create({
        type: "cleaning_request",
        status: "pending",
        bookingId,
        targetType: "event",
        roomId: null,
        eventVenueId: vid,
      });
      try {
        await housekeepingNotificationService.createCleaningTaskNew(
          taskDoc._id,
          bookingId,
          buildNewCleaningTaskMessage(fresh, "event")
        );
      } catch (err) {
        console.warn("[housekeeping] HK notification (new task):", err.message);
      }
    }
  } catch (err) {
    if (err && err.code === 11000) {
      return;
    }
    console.warn("[housekeeping] triggerAfterBookingApproved:", err.message);
  }
}

function toPublicTask(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const room = o.roomId && typeof o.roomId === "object" && o.roomId._id ? o.roomId : null;
  const venue = o.eventVenueId && typeof o.eventVenueId === "object" && o.eventVenueId._id ? o.eventVenueId : null;
  const booking = o.bookingId && typeof o.bookingId === "object" && o.bookingId._id ? o.bookingId : null;

  return {
    id: String(o._id),
    type: o.type,
    status: o.status,
    targetType: o.targetType,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    booking: booking
      ? {
          id: String(booking._id),
          customerName: booking.customerName ?? "",
          email: booking.email ?? "",
          contactNumber: booking.contactNumber ?? "",
          bookingType: booking.type,
          bookingStatus: booking.status,
          checkIn: booking.checkIn ?? "",
          checkOut: booking.checkOut ?? "",
          venueName: booking.venueName ?? "",
          eventTitle: booking.eventTitle ?? "",
          eventDate: booking.eventDate ?? "",
          eventEndDate: booking.eventEndDate ?? "",
        }
      : null,
    room: room
      ? {
          id: String(room._id),
          title: room.title,
          roomNumber: room.roomNumber,
          package: room.package ?? "",
          status: room.status ?? "available",
        }
      : null,
    eventVenue: venue
      ? {
          id: String(venue._id),
          name: venue.name,
          package: venue.package ?? "",
          eventNum: venue.eventNum,
          status: venue.status ?? "available",
        }
      : null,
  };
}

async function listTasks({ includeCompleted = false } = {}) {
  const filter = includeCompleted ? {} : { status: { $in: ["pending", "in_progress"] } };
  const rows = await HousekeepingTask.find(filter)
    .populate({ path: "roomId", select: "title roomNumber package status" })
    .populate({ path: "eventVenueId", select: "name package eventNum status" })
    .populate({
      path: "bookingId",
      select:
        "customerName email contactNumber type status checkIn checkOut venueName eventTitle eventDate eventEndDate roomTitle",
    })
    .sort({ createdAt: -1 })
    .limit(includeCompleted ? 200 : 100)
    .lean();

  return rows.map((r) => toPublicTask(r));
}

async function updateTaskStatus(taskId, body, _userId) {
  if (!mongoose.isValidObjectId(taskId)) {
    const err = new Error("Invalid task id");
    err.status = 400;
    throw err;
  }

  const next = body && body.status != null ? String(body.status).trim().toLowerCase() : "";
  if (next !== "in_progress" && next !== "completed") {
    const err = new Error('status must be "in_progress" or "completed"');
    err.status = 400;
    throw err;
  }

  const task = await HousekeepingTask.findById(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.status = 404;
    throw err;
  }

  if (next === "in_progress") {
    if (task.status !== "pending") {
      const err = new Error("Only pending tasks can move to in_progress");
      err.status = 409;
      throw err;
    }
    task.status = "in_progress";
    if (task.targetType === "room" && task.roomId) {
      await Room.findByIdAndUpdate(task.roomId, { status: "cleaning_in_progress" });
    } else if (task.targetType === "event" && task.eventVenueId) {
      await EventVenue.findByIdAndUpdate(task.eventVenueId, { status: "cleaning_in_progress" });
    }
  } else if (next === "completed") {
    if (task.status !== "in_progress") {
      const err = new Error("Only in_progress tasks can be completed");
      err.status = 409;
      throw err;
    }
    task.status = "completed";
    if (task.targetType === "room" && task.roomId) {
      await Room.findByIdAndUpdate(task.roomId, { status: "ready" });
    } else if (task.targetType === "event" && task.eventVenueId) {
      await EventVenue.findByIdAndUpdate(task.eventVenueId, { status: "ready" });
    }
  }

  await task.save();

  const populated = await HousekeepingTask.findById(task._id)
    .populate({ path: "roomId", select: "title roomNumber package status" })
    .populate({ path: "eventVenueId", select: "name package eventNum status" })
    .populate({
      path: "bookingId",
      select:
        "customerName email contactNumber type status checkIn checkOut venueName eventTitle eventDate eventEndDate roomTitle",
    })
    .lean();

  if (next === "completed" && populated) {
    try {
      const bid =
        populated.bookingId && populated.bookingId._id ? populated.bookingId._id : task.bookingId;
      const msg = buildCleaningCompletedMessage(populated);
      await staffNotificationService.createHousekeepingCleaningCompleted(bid, msg);
    } catch (err) {
      console.warn("[housekeeping] staff notification (cleaning done):", err.message);
    }
  }

  return toPublicTask(populated);
}

/**
 * Create missing HousekeepingTask rows for approved bookings (repair older data or failed triggers).
 * Safe to call repeatedly; unique index on bookingId prevents duplicates.
 */
const DEFAULT_RECENT_CLEANING_LIMIT = 10;

/**
 * Rooms and event venues currently flagged for cleaning, merged and sorted by most recently updated.
 * @param {{ limit?: number }} opts
 */
async function getRecentCleaningTasks({ limit = DEFAULT_RECENT_CLEANING_LIMIT } = {}) {
  const cap = Math.min(Math.max(Number(limit) || DEFAULT_RECENT_CLEANING_LIMIT, 1), 50);
  const perSource = Math.min(cap, 25);

  const [rooms, venues] = await Promise.all([
    Room.find({ status: "needs_cleaning" })
      .select("title roomNumber status updatedAt")
      .sort({ updatedAt: -1 })
      .limit(perSource)
      .lean(),
    EventVenue.find({ status: "needs_cleaning" })
      .select("name eventNum status updatedAt")
      .sort({ updatedAt: -1 })
      .limit(perSource)
      .lean(),
  ]);

  const roomItems = rooms.map((r) => {
    const rn = String(r.roomNumber ?? "").trim();
    const numParsed = Number(rn);
    const roomId =
      Number.isFinite(numParsed) && String(numParsed) === rn ? numParsed : rn || String(r._id);
    const title = String(r.title || "").trim();
    const roomName = title && rn ? `${title} — Room ${rn}` : title || (rn ? `Room ${rn}` : "Room");
    return {
      targetType: "room",
      id: String(r._id),
      roomId,
      roomName,
      status: r.status,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    };
  });

  const eventItems = venues.map((v) => {
    const evNum = String(v.eventNum ?? "").trim();
    const name = String(v.name || "").trim();
    const numParsed = Number(evNum);
    const eventId =
      Number.isFinite(numParsed) && String(numParsed) === evNum ? numParsed : evNum || String(v._id);
    const roomName = name && evNum ? `${name} — ${evNum}` : name || (evNum ? `Venue ${evNum}` : "Event venue");
    return {
      targetType: "event",
      id: String(v._id),
      eventId,
      roomName,
      status: v.status,
      updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : null,
    };
  });

  const merged = [...roomItems, ...eventItems].sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });

  return merged.slice(0, cap);
}

async function reconcileMissingTasks() {
  const Booking = require("../models/Booking");
  const { findOneBookingWithPopulateOrRaw } = require("./booking.service");

  const approved = await Booking.find({
    status: "approved",
    type: { $in: ["room", "event"] },
  })
    .select("_id")
    .lean();

  const existing = await HousekeepingTask.find({}).select("bookingId").lean();
  const have = new Set(existing.map((e) => String(e.bookingId)));

  let tasksCreated = 0;

  for (const row of approved) {
    const idStr = String(row._id);
    if (have.has(idStr)) continue;

    const fresh = await findOneBookingWithPopulateOrRaw(row._id);
    if (!fresh) continue;

    await triggerAfterBookingApproved(fresh);

    const t = await HousekeepingTask.findOne({ bookingId: row._id }).select("_id").lean();
    if (t) {
      tasksCreated += 1;
      have.add(idStr);
    }
  }

  return {
    approvedBookingsScanned: approved.length,
    tasksCreated,
  };
}

module.exports = {
  triggerAfterBookingApproved,
  listTasks,
  updateTaskStatus,
  reconcileMissingTasks,
  getRecentCleaningTasks,
};
