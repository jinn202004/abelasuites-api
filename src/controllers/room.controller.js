const mongoose = require("mongoose");
const roomService = require("../services/room.service");

/** Front desk housekeeping UI: Needs clean, Available (stored as ready). */
const FRONTDESK_HK_STATUSES = ["needs_cleaning", "ready"];

exports.list = async (req, res) => {
  const rooms = await roomService.list();
  res.json({ rooms });
};

exports.getById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid room id" });
  }
  const room = await roomService.getById(id);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json({ room });
};

exports.create = async (req, res) => {
  try {
    const room = await roomService.create(req.body);
    res.status(201).json({ room });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "roomNumber already in use" });
    }
    if (err.status === 400 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.patchHousekeepingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const st = String(status || "").trim();
    if (!FRONTDESK_HK_STATUSES.includes(st)) {
      return res.status(400).json({
        error: `status must be one of: ${FRONTDESK_HK_STATUSES.join(", ")}`,
      });
    }
    const room = await roomService.update(id, { status: st });
    res.json({ room });
  } catch (err) {
    if (
      err.status === 400 ||
      err.status === 404 ||
      err.status === 409
    ) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await roomService.update(id, req.body);
    res.json({ room });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "roomNumber already in use" });
    }
    if (
      err.status === 400 ||
      err.status === 404 ||
      err.status === 409
    ) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await roomService.remove(id);
    res.json({ room, deleted: true });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
