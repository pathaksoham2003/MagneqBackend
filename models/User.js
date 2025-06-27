import mongoose from "../utils/db.js";

const userSchema = new mongoose.Schema({
  name: String,
  role: String,
  password: String,
  user_name: String,
  created_at: Date,
  updated_at: Date,
});

export default mongoose.model('User', userSchema);
