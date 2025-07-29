import mongoose from "../utils/db.js";

const vendorSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Vendor", vendorSchema);
