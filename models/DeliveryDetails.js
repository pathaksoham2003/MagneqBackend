import mongoose from "../utils/db.js";

const deliveryDetailsSchema = new mongoose.Schema(
  {
    sales_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sales",
      required: true,
      unique: true, 
    },
    lr_number: {
      type: String,
      required: false,
    },
    transport_details: {
      type: String, 
      required: false,
    },
    dispatched_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dispatched_at: {
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryDetails", deliveryDetailsSchema);