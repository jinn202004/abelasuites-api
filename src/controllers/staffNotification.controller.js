const staffNotificationService = require("../services/staffNotification.service");

exports.list = async (req, res) => {
  const data = await staffNotificationService.listForUser(req.user.id);
  res.json(data);
};

exports.markAllRead = async (req, res) => {
  await staffNotificationService.markAllRead(req.user.id);
  const data = await staffNotificationService.listForUser(req.user.id);
  res.json(data);
};
