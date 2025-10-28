import mongoose from "../utils/db.js";

const paymentRecievalSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // references your Customer model
      required: true,
    },
    date_of_recieval: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()).toFixed(2), // always 2 decimals when reading
      set: (v) => parseFloat(v).toFixed(2),            // store with 2 decimals
    },
    description: {
      type: String,
    },
    transactionType: {
      type: String,
      enum: ["NEFT", "RTGS", "CHEQUE", "UPI"],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
    toJSON: { getters: true }, // so .get works in JSON output
    toObject: { getters: true },
  }
);

export default mongoose.model("PaymentRecieval", paymentRecievalSchema);
