const mongoose = require("mongoose");
const eventVenueService = require("../services/eventVenue.service");

exports.list = async (req, res) => {
  const eventVenues = await eventVenueService.list();
  res.json({ eventVenues });
};

exports.getById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid event venue id" });
  }
  const eventVenue = await eventVenueService.getById(id);
  if (!eventVenue) {
    return res.status(404).json({ error: "Event venue not found" });
  }
  res.json({ eventVenue });
};

exports.create = async (req, res) => {
  try {
    const eventVenue = await eventVenueService.create(req.body);
    res.status(201).json({ eventVenue });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "eventNum already in use" });
    }
    if (err.status === 400) {
      return res.status(400).json({
        error: err.message,
        ...(err.missing ? { missing: err.missing } : {}),
      });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const eventVenue = await eventVenueService.update(id, req.body);
    res.json({ eventVenue });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "eventNum already in use" });
    }
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const eventVenue = await eventVenueService.remove(id);
    res.json({ eventVenue, deleted: true });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
