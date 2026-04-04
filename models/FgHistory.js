import mongoose from "../utils/db.js";

const fgHistorySchema = new mongoose.Schema({
  finished_good_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods" },
  model: String,
  type: String,
  date: { type: Date, default: Date.now },
  change_type: { 
    type: String, 
    enum: ["PRODUCTION_ADDITION", "INVOICE_REDUCTION", "ADMIN_UPDATE"] 
  },
  quantity_changed: Number,
  current_quantity: Number,
  reference_text: String,
  changed_by: {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    user_name: String,
    email: String
  }
}, { timestamps: true });

export default mongoose.model("FgHistory", fgHistorySchema);
