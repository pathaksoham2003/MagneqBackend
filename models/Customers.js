import mongoose from "../utils/db.js";

const customerSchema = new mongoose.Schema({
  name: String,
  address:String,
  gst_no:String,
  created_at: Date,
  updated_at: Date,
});

export default mongoose.model('Customer', customerSchema);