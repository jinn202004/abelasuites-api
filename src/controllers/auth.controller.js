const authService = require("../services/auth.service");
const { validatePasswordStrength } = require("../utils/passwordValidation");
const { validateUsername } = require("../utils/usernameValidation");

function duplicateKeyMessage(err) {
  const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : null;
  if (key === "username") return "Username already taken";
  if (key === "email") return "Email already registered";
  return "Username or email already registered";
}

exports.register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await authService.register(username, email, password, {
      firstName,
      lastName,
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: duplicateKeyMessage(err) });
    }
    throw err;
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.status === 500) {
      return res.status(500).json({ error: err.message });
    }
    throw err;
  }
};
