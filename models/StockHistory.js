import mongoose from "../utils/db.js";

const stockHistorySchema = new mongoose.Schema({
  raw_material_id: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterials" },
  name: String,
  class_type: String,
  category_type: String,
  date: { type: Date, default: Date.now },
  change_type: { 
    type: String, 
    enum: ["ADD_STOCK", "CONSUMED", "ADMIN_UPDATE", "TRANSITION_UPDATE"] 
  },
  quantity_changed: Number,
  sub_type: String,
  current_quantity_snapshot: mongoose.Schema.Types.Mixed,
  reference_text: String,
  changed_by: {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    user_name: String,
    email: String
  },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase" },
  production_history_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionHistory" }
}, { timestamps: true });

export default mongoose.model("StockHistory", stockHistorySchema);
