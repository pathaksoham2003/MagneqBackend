import mongoose from "../utils/db.js";

const customerSchema = new mongoose.Schema({
  name: String,
  address:String,
  gst_no:String,
},{
  timestamps:true,
});

export default mongoose.model('Customer', customerSchema);