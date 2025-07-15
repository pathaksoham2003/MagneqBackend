import mongoose from "../utils/db.js";

const rawMaterialSchema = new mongoose.Schema({
  class_type: {
    type: String,
    enum: ["A", "B", "C"],
    default: null,
  },
  other_specification: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  quantity: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ processed: 0 }),
  },
  min_quantity: {
    type: Number,
    default: 0,
  },
  name: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    default: null,
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
