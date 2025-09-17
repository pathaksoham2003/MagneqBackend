import mongoose from "../utils/db.js";

const deliveryDetailsSchema = new mongoose.Schema(
  {
    invoices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice",
        required: true,
      },
    ],
    from: {
      state: { type: String, required: true },
      pin_code: { type: String, required: true },
    },
    to: {
      state: { type: String, required: true },
      pin_code: { type: String, required: true },
    },
    description: { type: String },
    lr_number: { type: String }, // added later
    transport_details: { type: String }, // added later
    dispatched_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dispatched_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryDetails", deliveryDetailsSchema);
