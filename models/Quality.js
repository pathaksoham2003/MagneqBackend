import mongoose from "../utils/db.js";

const qualitySchema = new mongoose.Schema({
  vendor: {
    type: String,
    maxlength: 200
  },
  issue: {
    type: String,
    required: true
  },
  action_taken: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

export default mongoose.model('Quality', qualitySchema);