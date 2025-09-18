import mongoose from "../utils/db.js";

const companyDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true },           // Company name
  address: { type: String },                        // Optional company address
  contact_number: { type: String },                 // Optional contact number
  email: { type: String },                          // Optional email
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },

  // Foreign key reference to User (admin)
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

// optional: update timestamp on save
companyDetailsSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

export default mongoose.model("CompanyDetails", companyDetailsSchema);
