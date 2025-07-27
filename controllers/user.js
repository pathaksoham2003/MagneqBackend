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
      user_name:user.user_name
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
