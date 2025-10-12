import mongoose from "../utils/db.js";
import AutoIncrementFactory from "mongoose-sequence";

const AutoIncrement = AutoIncrementFactory(mongoose);
const productionSchema = new mongoose.Schema(
  {
    pro_id:{type: Number, unique: true},
    finished_good: {type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods"},
    order_quantity: {type: Number},
    quantity: {type: Number},
    start_quantity: {type:Number,default:0},
    ready_quantity: {type:Number,default:0},
    customer_name: {type: String, default: "N/A"},
    created_at: Date,
    updated_at: Date,
    status: {type: String, enum: ["UN_PROCESSED", "IN_PROCESSES", "READY","COMPLETED"], default: "UN_PROCESSED"},
    isProduction: {type: Boolean, default: true},
  },
  {timestamps: true}
);
productionSchema.plugin(AutoIncrement, {inc_field: "pro_id"});
export default mongoose.model("Production", productionSchema);
