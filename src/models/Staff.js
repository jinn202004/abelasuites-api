const mongoose = require("mongoose");

/** Display labels aligned with admin UI (`admin_1/staff.jsx`). */
const STAFF_ROLES = ["Admin", "Front Desk", "Housekeeping", "Cashier"];

const STAFF_STATUSES = ["Active", "On Leave", "Inactive"];

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: STAFF_ROLES,
        message: "Invalid staff role",
      },
    },
    department: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    contact: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: STAFF_STATUSES,
        message: "Invalid status",
      },
      default: "Active",
    },
  },
  { timestamps: true }
);

const Staff = mongoose.model("Staff", staffSchema);

Staff.STAFF_ROLES = STAFF_ROLES;
Staff.STAFF_STATUSES = STAFF_STATUSES;

module.exports = Staff;
