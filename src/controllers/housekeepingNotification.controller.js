const housekeepingNotificationService = require("../services/housekeepingNotification.service");

exports.list = async (req, res) => {
  const data = await housekeepingNotificationService.listForUser(req.user.id);
  res.json(data);
};

exports.markAllRead = async (req, res) => {
  await housekeepingNotificationService.markAllRead(req.user.id);
  const data = await housekeepingNotificationService.listForUser(req.user.id);
  res.json(data);
};
