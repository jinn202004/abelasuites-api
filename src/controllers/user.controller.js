const mongoose = require("mongoose");
const userService = require("../services/user.service");

function duplicateKeyMessage(err) {
  const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : null;
  if (key === "email") return "Email already in use";
  return "Email already in use";
}

exports.getMe = async (req, res) => {
  const user = await userService.getById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
};

exports.getUser = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  const user = await userService.getById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
};

exports.updateMe = async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      role,
      currentPassword,
      newPassword,
    } = req.body;
    const user = await userService.updateMe(
      req.user.id,
      {
        email,
        firstName,
        lastName,
        role,
        currentPassword,
        newPassword,
      },
      req.user.role === "admin"
    );
    res.json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: duplicateKeyMessage(err) });
    }
    if (
      err.status === 400 ||
      err.status === 401 ||
      err.status === 403 ||
      err.status === 404
    ) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const isSelf = String(req.user.id) === String(id);
    const isAdmin = req.user.role === "admin";
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      email,
      firstName,
      lastName,
      role,
      currentPassword,
      newPassword,
    } = req.body;
    const user = await userService.updateUser(
      id,
      {
        email,
        firstName,
        lastName,
        role,
        currentPassword,
        newPassword,
      },
      { isSelf, isAdmin }
    );
    res.json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: duplicateKeyMessage(err) });
    }
    if (
      err.status === 400 ||
      err.status === 401 ||
      err.status === 403 ||
      err.status === 404
    ) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
