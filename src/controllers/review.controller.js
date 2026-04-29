const reviewService = require("../services/review.service");

exports.create = async (req, res) => {
  try {
    const review = await reviewService.createReview(req.user, req.body);
    res.status(201).json({ review });
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.listMine = async (req, res) => {
  const reviews = await reviewService.listMine(req.user);
  res.json({ reviews });
};

exports.listAll = async (req, res) => {
  const reviews = await reviewService.listAllForStaff();
  res.json({ reviews });
};

exports.approve = async (req, res) => {
  try {
    const review = await reviewService.approveReview(req.params.id);
    res.json({ review });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
