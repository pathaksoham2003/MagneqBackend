import mongoose from "../utils/db.js";

const salesSchema = new mongoose.Schema({
  order_id: String,
  model: String,
  type: { type: String }, // Flange/Foot
  ratio: String,
  quantity: Number,
  customer_name: String,
  magneq_user: String,
  description: String,
  status: { type: String, enum: ['Delivered', 'Dispatched', 'In process', 'FG'] },
  created_at: Date,
  updated_at: Date,
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

export default mongoose.model('Sales', salesSchema);
