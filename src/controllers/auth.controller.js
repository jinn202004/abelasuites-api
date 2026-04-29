const authService = require("../services/auth.service");
const { validatePasswordStrength } = require("../utils/passwordValidation");

function duplicateKeyMessage(err) {
  const kv = err.keyValue && typeof err.keyValue === "object" ? err.keyValue : {};
  if (kv.email != null && String(kv.email).trim() !== "") {
    return `An account with "${String(kv.email).trim()}" already exists. Sign in instead, or use a different email.`;
  }
  const parts = Object.entries(kv)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  if (parts) {
    return `Registration conflict (${parts}). Try signing in, or change the highlighted value.`;
  }
  return "Registration could not be completed because of a duplicate value. Try signing in, or use different details.";
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
    if (err.status === 409 && err.message) {
      return res.status(409).json({ error: err.message });
    }
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
