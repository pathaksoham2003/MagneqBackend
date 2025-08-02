import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
import Customer from "../models/Customers.js";
import RoutePermission from "../models/RoutePermission.js"; 

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const register = async (req, res) => {
  try {
    const {name, role, password, user_name} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      role,
      password: hashedPassword,
      user_name,
    });

    await user.save();

    const route = await RoutePermission.findOne({role});

    res.status(201).json({
      message: "User registered successfully.", 
      route,
    });
  } catch (err) {
    res.status(500).json({error: "Registration failed", details: err.message});
  }
};

export const login = async (req, res) => {
  try {
    console.log(req.body)
    const {user_name, password, role} = req.body;
    let user ;
    if(role?.toUpperCase() === "STAFF"){
      user = await User.findOne({user_name});
      if (!user) return res.status(401).json({error: "Invalid credentials"});
    } else {
      user = await Customer.findOne({user_name});
      if (!user) return res.status(401).json({error:"Invalid credentials"});
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({error: "Invalid credentials"});

    const payload = {
      id: user._id,
      name: user.name,
      role: user.role,
      user_name: user.user_name,
    };
    const info ={
      name:user.name,
      user_name:user.user_name,
      role: user.role,
    }
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    });

    const route = await RoutePermission.findOne({role: user.role});

    res.json({token, route,info});
  } catch (err) {
    console.log(err)
    res.status(500).json({error: "Login failed", details: err.message});
  }
};

export const updatePassword = async (req, res) => {
  const { user_name, current_password, new_password, role } = req.body;

  if (!user_name || !current_password || !new_password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    let userModel;

    // Select model based on role
    if(role.toUpperCase() == 'CUSTOMER'){
      userModel = Customer;
    }else {
      userModel = User
    }

    const user = await userModel.findOne({ user_name });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ success: 'Password updated successfully' });

  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
