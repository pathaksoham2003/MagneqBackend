import mongoose from '../utils/db.js';

const rawMaterialSchema = new mongoose.Schema({
  class_type: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: null,
  },
  other_specification: {
    type: mongoose.Schema.Types.Mixed, 
    default: null,
  },
  quantity: {
    type: Number,
    required: true, // ✅ Never null
  },
  casting_product: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    default: null,
  },
  product: {
    type: String,
    default: null,
  },
  select_items: {
    type: [mongoose.Schema.Types.Mixed], 
    default: [],
  },
  created_at: {
    type: Date,
    default: null,
  },
  updated_at: {
    type: Date,
    default: null,
  },
  expiry_date: {
    type: Date,
    default: null,
  },
});

export default mongoose.model('RawMaterials', rawMaterialSchema);
