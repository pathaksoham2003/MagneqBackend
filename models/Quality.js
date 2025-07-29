import mongoose from "../utils/db.js";

const qualitySchema = new mongoose.Schema(
  {
    finished_good: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FinishedGoods",
        required: true,
      },
    ],
    issue_type: {
      type: String,
      required: true,
    },
    vendor: {
      type: String,
      maxlength: 200,
    },
    issue: {
      type: String,
      required: true,
    },
    action_taken: {
      type: Boolean,
      default: false,
    },
    created_by: {type: String},
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("Quality", qualitySchema);
