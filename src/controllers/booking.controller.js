const mongoose = require("mongoose");
const bookingService = require("../services/booking.service");

exports.list = async (req, res) => {
  const bookings = await bookingService.list(req.user);
  res.json({ bookings });
};

exports.eventCalendar = async (_req, res) => {
  const bookings = await bookingService.listEventCalendarBookings();
  res.json({ bookings });
};

exports.getById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  const booking = await bookingService.getById(id, req.user);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  res.json({ booking });
};

exports.create = async (req, res) => {
  try {
    const booking = await bookingService.create(req.body, req.user);
    res.status(201).json({ booking });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await bookingService.update(id, req.body, req.user);
    res.json({ booking });
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await bookingService.remove(id, req.user);
    res.json({ booking, deleted: true });
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
