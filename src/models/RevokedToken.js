const mongoose = require("mongoose");

/**
 * Stores revoked access-token hashes until original JWT expiry (MongoDB TTL).
 * Enables logout for otherwise stateless JWTs.
 */
const revokedTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken = mongoose.model("RevokedToken", revokedTokenSchema);

module.exports = RevokedToken;
