const guestNotificationService = require("../services/guestNotification.service");

exports.listMine = async (req, res) => {
  const data = await guestNotificationService.listForUser(req.user.id);
  res.json(data);
};

exports.markRead = async (req, res) => {
  try {
    const n = await guestNotificationService.markRead(req.user.id, req.params.notificationId);
    res.json({ notification: n });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.markAllRead = async (req, res) => {
  const data = await guestNotificationService.markAllRead(req.user.id);
  res.json(data);
};
