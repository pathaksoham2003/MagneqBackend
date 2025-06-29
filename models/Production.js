import mongoose from "../utils/db.js";

const productionSchema = new mongoose.Schema(
  {
    order_id: Number,
    finished_good: {type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods"},
    quantity: {type: Number},
    created_at: Date,
    updated_at: Date,
    status: {type: String, enum: ["UN_PROCESSED", "IN_PROCESSES", "READY"]},
  },
  {timestamps: true}
);

export default mongoose.model("Production", productionSchema);
