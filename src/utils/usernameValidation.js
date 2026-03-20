/**
 * @returns {string | null} Error message if invalid, null if valid.
 */
function validateUsername(username) {
  const u = String(username).trim();
  if (u.length < 3 || u.length > 30) {
    return "Username must be between 3 and 30 characters";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return "Username may only contain letters, numbers, and underscores";
  }
  return null;
}

module.exports = { validateUsername };
