import mongoose from "../utils/db.js";
import AutoIncrementFactory from "mongoose-sequence";

const AutoIncrement = AutoIncrementFactory(mongoose);

const invoiceItemSchema = new mongoose.Schema(
  {
    sales_item: { type: mongoose.Schema.Types.ObjectId }, // reference to Sales.finished_goods item
    finished_good: { type: mongoose.Schema.Types.ObjectId, ref: "FinishedGoods" },
    description: String, // optional - FG details
    invoiced_quantity: { type: Number, required: true },
    rate_per_unit: { type: mongoose.Schema.Types.Decimal128, required: true },
    invoiced_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    taxes: [
      {
        type: { type: String, enum: ["IGST", "CGST", "SGST"] },
        percentage: { type: mongoose.Schema.Types.Decimal128 },
        amount: { type: mongoose.Schema.Types.Decimal128 },
      },
    ],
    total_with_tax: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    sales_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sales" },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    invoice_number: { type: Number, unique: true }, // auto increment invoice number
    status: {
      type: String,
      enum: ["DISPATCHED", "DELIVERED"],
      default: "DISPATCHED",
    },
    invoice_date: { type: Date, default: Date.now },
    due_date: { type: Date },
    items: [invoiceItemSchema],
    total_invoice_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
  },
  { timestamps: true }
);

invoiceSchema.plugin(AutoIncrement, { inc_field: "invoice_number" });

export default mongoose.model("Invoice", invoiceSchema);
