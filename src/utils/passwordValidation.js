/**
 * @returns {string | null} Error message if invalid, null if valid.
 */
function validatePasswordStrength(password) {
  const p = String(password);

  if (p.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (!/[a-z]/.test(p)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[A-Z]/.test(p)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(p)) {
    return "Password must contain at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(p)) {
    return "Password must contain at least one special character";
  }

  return null;
}

module.exports = { validatePasswordStrength };
