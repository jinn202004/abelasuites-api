const authService = require("../services/auth.service");
const { validatePasswordStrength } = require("../utils/passwordValidation");

function duplicateKeyMessage(err) {
  const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : null;
  if (key === "email") return "Email already registered";
  return "Email already registered";
}

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await authService.register(email, password, {
      firstName,
      lastName,
      phone,
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await authService.login(email, password);
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

/**
 * POST /auth/logout — requires `Authorization: Bearer <access_token>`.
 * Blacklists the token until its original expiry so it cannot be reused.
 */
exports.logout = async (req, res) => {
  try {
    const header = req.headers.authorization;
    const token = header && header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return res.status(400).json({ error: "No bearer token to revoke" });
    }

    await authService.revokeToken(token, req.user.id);
    res.status(200).json({ message: "Logged out successfully", revoked: true });
  } catch (err) {
    if (err.status === 400 || err.status === 403) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
