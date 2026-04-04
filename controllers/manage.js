import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterials from "../models/RawMaterials.js";
import User from "../models/User.js";
import Customer from "../models/Customers.js";
import Vendor from "../models/Vendors.js";
import mongoose from "../utils/db.js";
import {getFgModelNumber} from "../utils/helper.js";
import Vendors from "../models/Vendors.js";
import Customers from "../models/Customers.js";
import bcrypt from "bcrypt";
import logger from "../utils/logger.js";

const formatPaginatedResponse = (docs, fields, page = 1, pageSize = 20) => {
  const totalItems = docs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pagedDocs = docs.slice((page - 1) * pageSize, page * pageSize);

  return {
    header: fields,
    item: pagedDocs.map((doc) => ({
      id: doc._id,
      data: fields.map((field) => {
        const value = doc[field];
        if (
          value &&
          typeof value === "object" &&
          value._bsontype === "Decimal128"
        ) {
          return value.toString();
        }
        return value;
      }),
    })),
    page_no: page,
    total_pages: totalPages,
    total_items: totalItems,
  };
};

export const getUsers = async (req, res, next) => {
  try {
    const {page = 1, limit = 20} = req.query;
    const data = await User.find();
    const fields = ["name", "user_name", "role"];
    res
      .status(200)
      .json(formatPaginatedResponse(data, fields, Number(page), Number(limit)));
  } catch (e) {
    next(e);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const {name, role, user_name, password,state,pin_code, gst_no, address, phone} = req.body;

    if (role == "SUPPLIER") {
      if (!name || !phone) {
        return res.status(400).json({message: "Missing required fields"});
      }
      const vendor = new Vendors({
        name,
        phone,
        address,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const savedUser = await vendor.save();
      return res.status(201).json(savedUser);
    }

    if (role == "CUSTOMER") {
      if (!name || !role || !user_name || !password) {
        return res.status(400).json({message: "Missing required fields"});
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const customer = new Customers({
        name,
        role,
        user_name,
        gst_no,
        phone,
        pin_code,
        state:state.toUpperCase(),
        address,
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const savedCustomer = await customer.save();
      return res.status(201).json(savedCustomer);
    }

    if (!name || !role || !user_name || !password) {
      return res.status(400).json({message: "Missing required fields"});
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      role,
      user_name,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const savedUser = await user.save();
    res.status(201).json(savedUser);
    logger.info(`${role} created: ${name} by ${req.user.user_name}`);
    res.status(201).json(savedUser);
  } catch (e) {
    next(e);
  }
};

export const getFinishedGoods = async (req, res, next) => {
  try {
    const { model, type, ratio, power, page = 1, limit = 20 } = req.query;
    const userRole = req.user?.role;

    const filter = {};
    if (model) filter.model = model;
    if (type) filter.type = type;
    if (ratio) filter.ratio = ratio;
    if (power) filter.power = power.trim(); // now a string, no Decimal128

    const data = await FinishedGoods.find(filter).lean();

    const enhancedData = data.map((item) => ({
      ...item,
      model_number: getFgModelNumber(item),
    }));

    // Conditionally include units field based on user role
    const fields = ["model_number", "model", "power", "ratio", "type"];
    if (userRole !== "DEVELOPER") {
      fields.push("units");
    }

    res.status(200).json(
      formatPaginatedResponse(
        enhancedData,
        fields,
        Number(page),
        Number(limit)
      )
    );
  } catch (e) {
    next(e);
  }
};

export const getRawMaterialsByClass = async (req, res, next) => {
  try {
    const {class_type} = req.params;
    const {page = 1, limit = 20} = req.query;

    const data = await RawMaterials.find({
      class_type: class_type.toUpperCase(),
    });

    // Process data to remove "processed:" prefix for class types A and C
    const processedData = data.map((item) => {
      if ((class_type.toUpperCase() === "A" || class_type.toUpperCase() === "C") && 
          typeof item.quantity === "object" && item.quantity !== null) {
        // Create a new object without the processed field
        const { processed, ...otherQuantities } = item.quantity;
        return {
          ...item.toObject(),
          quantity: otherQuantities
        };
      }
      return item;
    });

    const fields = ["class_type", "name", "quantity"];
    res
      .status(200)
      .json(formatPaginatedResponse(processedData, fields, Number(page), Number(limit)));
  } catch (e) {
    next(e);
  }
};

export const getUsersByRole = async (req, res, next) => {
  try {
    const {role, page = 1, search = ""} = req.query;
    const PAGE_SIZE = 10;
    const pageNo = parseInt(page);
    const skip = (pageNo - 1) * PAGE_SIZE;

    let filter = {};

    // 🟩 Handle CUSTOMER role using Customer model
    if (role === "CUSTOMER") {
      const searchRegex = {$regex: search, $options: "i"};
      if (search.trim() !== "") {
        filter.$or = [
          {name: searchRegex},
          {phone: searchRegex},
          {email: searchRegex},
        ];
      }

      const totalCount = await Customer.countDocuments(filter);
      const customers = await Customer.find(filter)
        .skip(skip)
        .limit(PAGE_SIZE)
        .sort({createdAt: -1});

      const formatted = customers.map((c) => ({
        name: c.name,
        user_name: c.email || c.phone || "-",
        role: "CUSTOMER",
        created_at: c.createdAt?.toISOString().split("T")[0] || "",
      }));

      return res.status(200).json({
        header: ["Name", "Username", "Role", "Created At"],
        item: formatted,
        page_no: pageNo,
        total_pages: Math.ceil(totalCount / PAGE_SIZE),
        total_items: totalCount,
      });
    }

    // 🟦 Handle SUPPLIER role using Vendor model
    if (role === "SUPPLIER") {
      const searchRegex = {$regex: search, $options: "i"};
      if (search.trim() !== "") {
        filter.$or = [{name: searchRegex}, {phone: searchRegex}];
      }

      const totalCount = await Vendor.countDocuments(filter);
      const vendors = await Vendor.find(filter)
        .skip(skip)
        .limit(PAGE_SIZE)
        .sort({createdAt: -1});

      const formatted = vendors.map((v) => ({
        id: v._id,
        name: v.name,
        phone: v.phone,
        address: v.address,
        created_at: v.createdAt?.toISOString().split("T")[0] || "",
      }));

      return res.status(200).json({
        header: ["Name", "Phone", "Address", "Created At"],
        item: formatted,
        page_no: pageNo,
        total_pages: Math.ceil(totalCount / PAGE_SIZE),
        total_items: totalCount,
      });
    }

    // 🟥 Handle remaining roles via User model
    filter.role = {$nin: ["CUSTOMER", "SUPPLIER"]};

    if (search.trim() !== "") {
      const searchRegex = {$regex: search, $options: "i"};
      filter.$or = [
        {name: searchRegex},
        {user_name: searchRegex},
        {role: searchRegex},
      ];
    }

    const totalCount = await User.countDocuments(filter);
    const users = await User.find(filter)
      .skip(skip)
      .limit(PAGE_SIZE)
      .sort({created_at: -1});

    const formattedUsers = users.map((user) => ({
      id: user._id,
      name: user.name,
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at?.toISOString().split("T")[0] || "",
    }));

    res.status(200).json({
      header: ["Name", "Username", "Role", "Created At"],
      item: formattedUsers,
      page_no: pageNo,
      total_pages: Math.ceil(totalCount / PAGE_SIZE),
      total_items: totalCount,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllCustomers = async (req, res, next) => {
  try {
    const {page, limit = 10, search = ""} = req.query;
    const pageNo = parseInt(page);
    const pageSize = 10;

    const searchRegex = new RegExp(search, "i");
    const filter = search ? {name: searchRegex} : {};

    const totalItems = await Customer.countDocuments(filter);

    const customers = await Customer.find(filter)
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize);

    const formatted = customers.map((customer) => ({
      id: customer._id,
      data: [
        customer.name || "",
        customer.address || "",
        customer.gst_no || "",
      ],
    }));
    res.status(200).json({
      header: ["Customer Name", "Address", "GST No"],
      item: formatted,
      page_no: pageNo,
      total_pages: Math.ceil(totalItems / pageSize),
      total_items: totalItems,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllVendors = async (req, res, next) => {
  try {
    const {page, limit = 10, search = ""} = req.query;
    const pageNo = parseInt(page);
    const pageSize = 10;

    const searchRegex = new RegExp(search, "i");
    const filter = search ? {name: searchRegex} : {};

    const totalItems = await Vendor.countDocuments(filter);

    const vendors = await Vendor.find(filter)
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize);

    const formatted = vendors.map((vendor) => ({
      id: vendor._id,
      data: [vendor.name || "", vendor.phone || ""],
    }));
    res.status(200).json({
      header: ["Vendor Name", "Phone Number"],
      item: formatted,
      page_no: pageNo,
      total_pages: Math.ceil(totalItems / pageSize),
      total_items: totalItems,
    });
  } catch (err) {
    next(err);
  }
};

export const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Vendor.findById(id);
    
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    
    res.status(200).json(supplier);
  } catch (err) {
    next(err);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }
    
    const updatedSupplier = await Vendor.findByIdAndUpdate(
      id,
      { name, phone, address, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    
    logger.info(`Supplier updated: ${name} (${id}) by ${req.user.user_name}`);
    res.status(200).json({
      message: "Supplier updated successfully",
      supplier: updatedSupplier
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, pin_code, state, gst_no, phone } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { 
        name, 
        address, 
        pin_code, 
        state: state?.toUpperCase(), 
        gst_no, 
        phone,
        updatedAt: new Date() 
      },
      { new: true }
    );
    
    if (!updatedCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    logger.info(`Customer updated: ${name} (${id}) by ${req.user.user_name}`);
    res.status(200).json({
      message: "Customer updated successfully",
      customer: updatedCustomer
    });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ error: "Name and role are required" });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { 
        name, 
        role,
        updated_at: new Date() 
      },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    logger.info(`User updated: ${name} (${id}) by ${req.user.user_name}`);
    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (err) {
    next(err);
  }
};