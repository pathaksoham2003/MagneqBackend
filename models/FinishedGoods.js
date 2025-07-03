import mongoose from "../utils/db.js";

const finishedGoodsSchema = new mongoose.Schema({
  model: String,
  type: String,
  ratio: String,
  other_specification: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  raw_materials: [
    {
      raw_material_id: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterials" },
      quantity: { type: Number, required: true },
    },
  ],
  rate_per_unit: { type: mongoose.Schema.Types.Decimal128, default: 0.0 },
  base_price: { type: mongoose.Schema.Types.Decimal128, default: 0.0 }, 
  units: Number,
});

export default mongoose.model("FinishedGoods", finishedGoodsSchema);
