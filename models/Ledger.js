import mongoose from "../utils/db.js";

const ledgerEntrySchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    details: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Ledger", ledgerEntrySchema);
