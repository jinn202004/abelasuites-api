const mongoose = require("mongoose");
const bookingApprovalService = require("../services/bookingApproval.service");

exports.getPendingBookingsWithGuest = async (req, res) => {
  const bookings = await bookingApprovalService.getPendingBookingsWithGuest();
  res.json({ bookings });
};

exports.getBookingHistoryWithGuest = async (req, res) => {
  const bookings = await bookingApprovalService.getBookingHistoryWithGuest();
  res.json({ bookings });
};

exports.approveBooking = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  try {
    const booking = await bookingApprovalService.approveBooking(id, req.user.id);
    res.json({ booking });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.rejectBooking = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  const reason =
    req.body && (req.body.reason !== undefined ? req.body.reason : req.body.declineReason);
  try {
    const booking = await bookingApprovalService.rejectBooking(id, req.user.id, reason);
    res.json({ booking });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
