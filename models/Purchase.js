import mongoose from "../utils/db.js";
import AutoIncrementFactory from "mongoose-sequence";

const AutoIncrement = AutoIncrementFactory(mongoose);

const purchaseItemSchema = new mongoose.Schema({
  raw_material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterials' },
  quantity: Number,
  recieved_quantity: Number,
  status: String
});

const purchaseSchema = new mongoose.Schema({
  po_number: {type: Number, unique: true},
  vendor_name: String,
  purchasing_date: Date,
  items: [purchaseItemSchema],
  status: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

purchaseSchema.plugin(AutoIncrement, {inc_field: "po_number"});

export default mongoose.model('Purchase', purchaseSchema);
