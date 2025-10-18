import mongoose from "../utils/db.js";
import AutoIncrementFactory from "mongoose-sequence";

const AutoIncrement = AutoIncrementFactory(mongoose);

const salesItemSchema = new mongoose.Schema(
  {
    finished_good: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinishedGoods",
    },
    rate_per_unit: { type: mongoose.Schema.Types.Decimal128 },
    quantity: Number,
    invoiced_quantity: { type: Number, default: 0 },
    total_invoiced_quantity: Number,
    item_total_price: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    status: { 
      type: String, 
      enum: ["PENDING", "INPROCESS", "PROCESSED"], 
      default: "PENDING" 
    },
  },
  { _id: false }
);

const salesSchema = new mongoose.Schema(
  {
    order_id: { type: Number, unique: true },
    finished_goods: [salesItemSchema],
    customer_name: String,
    magneq_user: String,
    description: String,
    status: {
      type: String,
      enum: [
        "UN_APPROVED",
        "INPROCESS",
        "PROCESSED",
        "DISPATCHED",
        "DELIVERED",
        "CANCELLED",
      ],
    },
    delivery_date: {
      type: Date,
    },
    created_for: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    total_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    recieved_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    approved_reject_by: String,
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    customer_created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true }
);

salesSchema.plugin(AutoIncrement, { inc_field: "order_id" });

export default mongoose.model("Sales", salesSchema);
