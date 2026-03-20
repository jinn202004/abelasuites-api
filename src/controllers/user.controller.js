const mongoose = require("mongoose");
const userService = require("../services/user.service");

function duplicateKeyMessage(err) {
  const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : null;
  if (key === "username") return "Username already taken";
  if (key === "email") return "Email already in use";
  return "Username or email already in use";
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
    const { username, email, firstName, lastName, currentPassword, newPassword } =
      req.body;
    const user = await userService.updateMe(req.user.id, {
      username,
      email,
      firstName,
      lastName,
      currentPassword,
      newPassword,
    });
    res.json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: duplicateKeyMessage(err) });
    }
    if (err.status === 400 || err.status === 401 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
