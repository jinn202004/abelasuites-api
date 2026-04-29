const notificationService = require("../services/notification.service");

exports.listMine = async (req, res) => {
  const data = await notificationService.listForUser(req.user);
  res.json(data);
};

exports.markRead = async (req, res) => {
  try {
    const notification = await notificationService.markRead(req.user, req.params.id);
    res.json({ notification });
  } catch (err) {
    if (err.status === 400 || err.status === 401 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.markAllRead = async (req, res) => {
  const data = await notificationService.markAllRead(req.user);
  res.json(data);
};
