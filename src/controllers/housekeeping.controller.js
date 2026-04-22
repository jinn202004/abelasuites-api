const housekeepingService = require("../services/housekeeping.service");

exports.getTasks = async (req, res) => {
  const includeCompleted =
    req.query.includeCompleted === "1" || String(req.query.includeCompleted).toLowerCase() === "true";
  const tasks = await housekeepingService.listTasks({ includeCompleted });
  res.json({ tasks });
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const task = await housekeepingService.updateTaskStatus(req.params.id, req.body, req.user.id);
    res.json({ task });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

/** POST — create HousekeepingTask rows for approved bookings that are missing them */
exports.reconcileMissing = async (req, res) => {
  const result = await housekeepingService.reconcileMissingTasks();
  res.json(result);
};
