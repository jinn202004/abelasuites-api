const mongoose = require("mongoose");
const billingService = require("../services/billing.service");

exports.getAllBillingRecords = async (req, res) => {
  const records = await billingService.getAllBillingRecords(req.user);
  res.json({ records });
};

exports.getMyBilling = async (req, res) => {
  const records = await billingService.getMyBillingRecords(req.user);
  res.json({ records });
};

exports.getGuestBillingDetails = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid billing id" });
  }
  try {
    const record = await billingService.getGuestBillingDetails(id, req.user);
    res.json(record);
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.updatePayment = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid billing id" });
  }
  try {
    const record = await billingService.updatePayment(id, req.body, req.user);
    res.json(record);
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
