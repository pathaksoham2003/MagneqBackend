import mongoose from "../utils/db.js";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      default: "PENDING",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Notification", notificationSchema);
