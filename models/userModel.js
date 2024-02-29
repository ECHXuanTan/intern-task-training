import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{ type: String, required: true },
    username:{ type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: {type: String},
    background_img: { type: String },
    publicKey:{ type: String },
    privateKey:{ type: String },
    last_login: {type: Date},
    userSetting: { type: Array },
  },
  {
    timestamps: true,
  });

const User = mongoose.model('User', userSchema);
export default User;

