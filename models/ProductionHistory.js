import mongoose from "../utils/db.js";

const productionHistorySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  finished_good_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods" },
  model: String,
  type: String,
  quantity_produced: Number,
  reference_text: String,
  changed_by: {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    user_name: String,
    email: String
  },
  raw_materials_used: [
    {
      raw_material_id: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterials" },
      name: String,
      class_type: String,
      quantity_consumed: Number
    }
  ]
}, { timestamps: true });

export default mongoose.model("ProductionHistory", productionHistorySchema);
