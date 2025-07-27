import mongoose from "../utils/db.js";

const customerSchema = new mongoose.Schema({
  name: String,
  address:String,
  gst_no:String,
  password: String,
  user_name: String,
  phone: {
    type: String,
    match: /^[0-9]{10}$/,
  },
  role: { type: String, default: 'CUSTOMER' },
},{
  timestamps:true,
});

export default mongoose.model('Customer', customerSchema);