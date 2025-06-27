import mongoose from "../utils/db.js";

const purchaseItemSchema = new mongoose.Schema({
  raw_material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterials' },
  quantity: Number,
  status: String
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  vendor_name: String,
  purchasing_date: Date,
  items: [purchaseItemSchema],
  status: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('Purchase', purchaseSchema);
