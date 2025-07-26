import mongoose from "../utils/db.js";

const vendorSchema = new mongoose.Schema({
  name: String,
  phone:Number,
},{
  timestamps:true,
});

export default mongoose.model('Vendor', vendorSchema);