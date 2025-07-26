import mongoose from "../utils/db.js";

const vendorSchema = new mongoose.Schema({
  name: String,
  phone:Number,
  created_at: Date,
  updated_at: Date,
});

export default mongoose.model('Vendor', vendorSchema);