import { Mongoose } from "mongoose";
import mongoose from "../utils/db.js";

const invoiceItemSchema = new mongoose.Schema(
  {
    sales_item: { type: mongoose.Schema.Types.ObjectId }, // reference to Sales.finished_goods item
    invoiced_quantity: { type: Number, required: true },
    invoiced_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    taxes: [
      {
        type: { type: String, enum: ["IGST", "CGST", "SGST"] },
        percentage: { type: mongoose.Schema.Types.Decimal128 },
        amount: { type: mongoose.Schema.Types.Decimal128 },
      },
    ],
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    sales_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sales" },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    invoice_number: { type: String, unique: true },
    status: {
      type: String,
      enum: ["DISPATCHED", "DELIVERED"],
      default: "DISPATCHED",
    },
    delivery_date: { type: Date },
    due_date: { type: Date },
    items: [invoiceItemSchema],
    total_invoice_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
