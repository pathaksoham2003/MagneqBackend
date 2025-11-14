import mongoose from "../utils/db.js";

const transactionSchema = new mongoose.Schema(
  {
    model_name: {
      type: String,
      enum: ["RAW_MATERIAL", "FINISHED_GOOD", "LEDGER"],
      required: true,
    },
    reference_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    prev_value: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    updated_value: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    field_name: {
      type: String,
      required: true,
    },
    transaction_type: {
      type: String,
      enum: [
        "CREDIT",
        "DEBIT",
      ],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);

