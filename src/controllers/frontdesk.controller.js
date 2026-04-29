const mongoose = require("mongoose");
const frontdeskService = require("../services/frontdesk.service");

/** GET /api/frontdesk/summary — metrics from same DB queries as bookings + billing */
exports.getDashboardSummary = async (req, res) => {
  const data = await frontdeskService.getDashboardSummaryMetrics(req.user);
  res.json(data);
};

exports.getFrontdeskBookingDetails = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  try {
    const data = await frontdeskService.getFrontdeskBookingDetails(id);
    res.json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
