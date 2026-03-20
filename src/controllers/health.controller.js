exports.getHealth = (_req, res) => {
  res.json({ ok: true, service: "joanah-api" });
};
