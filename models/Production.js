import mongoose from "../utils/db.js";
import AutoIncrementFactory from "mongoose-sequence";

const AutoIncrement = AutoIncrementFactory(mongoose);
const productionSchema = new mongoose.Schema(
  {
    order_id: Number,
    pro_id:{type: Number, unique: true},
    finished_good: {type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods"},
    quantity: {type: Number},
    customer_name: String,
    created_at: Date,
    updated_at: Date,
    status: {type: String, enum: ["UN_PROCESSED", "IN_PROCESSES", "READY","COMPLETED"]},
    isProduction: Boolean,
  },
  {timestamps: true}
);
productionSchema.plugin(AutoIncrement, {inc_field: "pro_id"});
export default mongoose.model("Production", productionSchema);
