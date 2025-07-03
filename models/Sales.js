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
    item_total_price: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    status: {type: Boolean, default: false},
  },
  {_id: false}
);

const salesSchema = new mongoose.Schema(
  {
    order_id: {type: Number, unique: true},
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
    total_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    created_by: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  },
  {timestamps: true}
);

salesSchema.plugin(AutoIncrement, {inc_field: "order_id"});

export default mongoose.model("Sales", salesSchema);
