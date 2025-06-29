import mongoose from "../utils/db.js";

const rawMaterialSchema = new mongoose.Schema({
  class_type: {
    type: String,
    enum: ["A", "B", "C"],
    default: null,
  },
  model: {
    type: String,
  },
  other_specification: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  quantity: {
    type: Number,
    required: true,
  },
  min_quantity: {
    type: Number,
    default: 0,
  },
  casting_product: {
    type: String,
    default: null,
  },
  type: {
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

export default mongoose.model("RawMaterials", rawMaterialSchema);
