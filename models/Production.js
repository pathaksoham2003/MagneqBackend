import mongoose from "../utils/db.js";

const productionSchema = new mongoose.Schema({
  order_id: String,
  created_at: Date,
  updated_at: Date,
  status: { type: String, enum: ['in stock', 'not in stock', 'store_fg'] }
});

export default mongoose.model('Production', productionSchema);
