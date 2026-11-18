const restaurantOrderService = require("../services/restaurantOrder.service");
const guestService = require("../services/guest.service");

exports.list = async (req, res) => {
  const role = req.user?.role;
  const filters = {
    status: req.query.status,
    source: req.query.source,
    limit: req.query.limit,
  };

  if (role === "guest") {
    const guest = await guestService.findGuestByUserId(req.user.id);
    if (!guest) {
      return res.json({ orders: [] });
    }
    filters.guestId = String(guest._id);
  } else if (req.query.guestId) {
    filters.guestId = req.query.guestId;
  }

  const orders = await restaurantOrderService.list(filters);
  res.json({ orders });
};

exports.create = async (req, res) => {
  try {
    const role = req.user?.role;
    const source = role === "guest" ? "guest" : "pos";
    const order = await restaurantOrderService.createFromActor(req.user, req.body, { source });
    res.status(201).json({ order });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
};

exports.patchPayment = async (req, res) => {
  try {
    const order = await restaurantOrderService.patchPayment(req.params.id, req.body);
    res.json({ order });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.patchStatus = async (req, res) => {
  try {
    const order = await restaurantOrderService.patchStatus(req.params.id, req.body?.status);
    res.json({ order });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
