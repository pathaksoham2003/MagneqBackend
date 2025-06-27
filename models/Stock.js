import mongoose from "../utils/db.js";

const stockSchema = new mongoose.Schema({
  raw_materials: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterials' },
  units: Number
});

export default mongoose.model('Stock', stockSchema);
