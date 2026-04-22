const staffService = require("../services/staff.service");

exports.list = async (req, res) => {
  const staff = await staffService.list();
  res.json({ staff });
};

exports.create = async (req, res) => {
  try {
    const staff = await staffService.create(req.body);
    res.status(201).json({ staff });
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await staffService.update(id, req.body);
    res.json({ staff });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await staffService.remove(id);
    res.json({ staff, deleted: true });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
