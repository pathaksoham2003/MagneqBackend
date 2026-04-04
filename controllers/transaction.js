import Transaction from "../models/Transaction.js";
import RawMaterials from "../models/RawMaterials.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Ledger from "../models/Ledger.js";
import mongoose from "mongoose";
import FgHistory from "../models/FgHistory.js";
import StockHistory from "../models/StockHistory.js";
import logger from "../utils/logger.js";

/**
 * Create a transaction record
 */
export const createTransaction = async (req, res, next) => {
  try {
    const {
      model_name,
      reference_id,
      prev_value,
      updated_value,
      label,
      field_name,
      transaction_type,
    } = req.body;

    // Validation
    if (!model_name || !reference_id || updated_value === undefined || !label || !field_name) {
      return res.status(400).json({
        error: "Missing required fields: model_name, reference_id, updated_value, label, field_name",
      });
    }

    if (!["RAW_MATERIAL", "FINISHED_GOOD", "LEDGER"].includes(model_name)) {
      return res.status(400).json({ 
        error: "Invalid model_name. Must be 'RAW_MATERIAL', 'FINISHED_GOOD', or 'LEDGER'" 
      });
    }

    // Validate transaction_type if provided
    let validTransactionType = null;
    if (transaction_type) {
      if (!["CREDIT", "DEBIT"].includes(transaction_type)) {
        return res.status(400).json({
          error: "Invalid transaction_type. Must be 'CREDIT' or 'DEBIT'",
        });
      }
      validTransactionType = transaction_type;
    }

    // Verify the model exists
    let model;
    if (model_name === "RAW_MATERIAL") {
      model = await RawMaterials.findById(reference_id);
      if (!model) {
        return res.status(404).json({ error: "RawMaterial not found" });
      }
    } else if (model_name === "FINISHED_GOOD") {
      model = await FinishedGoods.findById(reference_id);
      if (!model) {
        return res.status(404).json({ error: "FinishedGood not found" });
      }
    } else if (model_name === "LEDGER") {
      model = await Ledger.findById(reference_id);
      if (!model) {
        return res.status(404).json({ error: "Ledger entry not found" });
      }
    }

    // Create transaction
    const transaction = new Transaction({
      model_name,
      reference_id,
      prev_value: prev_value != null ? mongoose.Types.Decimal128.fromString(prev_value.toString()) : null,
      updated_value: mongoose.Types.Decimal128.fromString(updated_value.toString()),
      label,
      field_name,
      transaction_type: validTransactionType,
      created_by: req.user?.id || null,
    });

    await transaction.save();

    res.status(201).json({
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update RawMaterial stock and create transaction
 */
export const updateRawMaterialStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { field_name, value, label, transaction_type } = req.body;

    if (!field_name || value === undefined || !label) {
      return res.status(400).json({
        error: "Missing required fields: field_name, value, label",
      });
    }

    // Validate field_name based on class_type
    const material = await RawMaterials.findById(id);
    if (!material) {
      return res.status(404).json({ error: "RawMaterial not found" });
    }

    const classType = material.class_type;
    let validFields = [];

    if (classType === "A" || classType === "C") {
      validFields = ["processed"];
    } else if (classType === "B") {
      validFields = ["unprocessed", "hobbing", "ht", "processed"];
    }

    if (!validFields.includes(field_name)) {
      return res.status(400).json({
        error: `Invalid field_name '${field_name}' for class type '${classType}'. Valid fields: ${validFields.join(", ")}`,
      });
    }

    // Get old value
    const quantity = material.quantity || {};
    const prevValue = parseFloat(quantity[field_name] || 0);
    const updatedValue = parseFloat(value);

    // Update the material
    if (!quantity.hasOwnProperty(field_name)) {
      quantity[field_name] = 0;
    }
    quantity[field_name] = updatedValue;
    material.quantity = quantity;
    material.markModified("quantity");
    material.updated_at = new Date();
    await material.save();

    // Validate transaction_type if provided
    let validTransactionType = null;
    if (transaction_type) {
      if (!["CREDIT", "DEBIT"].includes(transaction_type)) {
        return res.status(400).json({
          error: "Invalid transaction_type. Must be 'CREDIT' or 'DEBIT'",
        });
      }
      validTransactionType = transaction_type;
    }

    // Create transaction record
    const transaction = new Transaction({
      model_name: "RAW_MATERIAL",
      reference_id: id,
      prev_value: mongoose.Types.Decimal128.fromString(prevValue.toString()),
      updated_value: mongoose.Types.Decimal128.fromString(updatedValue.toString()),
      label,
      field_name,
      transaction_type: validTransactionType,
      created_by: req.user?.id || null,
    });
    await transaction.save();

    // Log Stock History for Admin Update
    await StockHistory.create({
      raw_material_id: material._id,
      name: material.name,
      class_type: material.class_type,
      category_type: material.type,
      change_type: "ADMIN_UPDATE",
      quantity_changed: updatedValue - prevValue,
      sub_type: field_name,
      current_quantity_snapshot: material.quantity,
      reference_text: label || "Admin Manual Update",
      changed_by: req.user ? {
        user_id: req.user.id,
        name: req.user.name,
        user_name: req.user.user_name,
        email: req.user.email
      } : undefined
    });

    logger.warn(`Manual raw material stock update: ${material.name} by ${req.user.user_name}. ${field_name}: ${prevValue} -> ${updatedValue}`);
    res.status(200).json({
      message: "RawMaterial stock updated and transaction recorded",
      material,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update FinishedGood units and create transaction
 */
export const updateFinishedGoodUnits = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { value, label, transaction_type } = req.body;

    if (value === undefined || !label) {
      return res.status(400).json({
        error: "Missing required fields: value, label",
      });
    }

    const finishedGood = await FinishedGoods.findById(id);
    if (!finishedGood) {
      return res.status(404).json({ error: "FinishedGood not found" });
    }

    // Get old value
    const prevValue = parseFloat(finishedGood.units || 0);
    const updatedValue = parseFloat(value);

    // Update finished good
    finishedGood.units = updatedValue;
    await finishedGood.save();

    // Validate transaction_type if provided
    let validTransactionType = null;
    if (transaction_type) {
      if (!["CREDIT", "DEBIT"].includes(transaction_type)) {
        return res.status(400).json({
          error: "Invalid transaction_type. Must be 'CREDIT' or 'DEBIT'",
        });
      }
      validTransactionType = transaction_type;
    }

    // Create transaction record
    const transaction = new Transaction({
      model_name: "FINISHED_GOOD",
      reference_id: id,
      prev_value: mongoose.Types.Decimal128.fromString(prevValue.toString()),
      updated_value: mongoose.Types.Decimal128.fromString(updatedValue.toString()),
      label,
      field_name: "units",
      transaction_type: validTransactionType,
      created_by: req.user?.id || null,
    });
    await transaction.save();

    // Log FG History for Admin Update
    await FgHistory.create({
      finished_good_id: finishedGood._id,
      model: finishedGood.model,
      type: finishedGood.type,
      change_type: "ADMIN_UPDATE",
      quantity_changed: updatedValue - prevValue,
      current_quantity: updatedValue,
      reference_text: label || "Admin Manual Update",
      changed_by: req.user ? {
        user_id: req.user.id,
        name: req.user.name,
        user_name: req.user.user_name,
        email: req.user.email
      } : undefined
    });

    logger.warn(`Manual finished good units update: ${finishedGood.model} by ${req.user.user_name}. units: ${prevValue} -> ${updatedValue}`);
    res.status(200).json({
      message: "FinishedGood units updated and transaction recorded",
      finishedGood,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all transactions with optional filters
 */
export const getTransactions = async (req, res, next) => {
  try {
    const { model_name, reference_id, transaction_type, startDate, endDate, limit = 100, skip = 0 } = req.query;

    const query = {};

    if (model_name) query.model_name = model_name;
    if (reference_id) query.reference_id = reference_id;
    if (transaction_type) query.transaction_type = transaction_type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    let transactions = await Transaction.find(query)
      .populate("created_by", "name user_name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Manually populate reference_id based on model_name
    for (const transaction of transactions) {
      if (transaction.model_name === "RAW_MATERIAL") {
        const material = await RawMaterials.findById(transaction.reference_id)
          .select("name type class_type")
          .lean();
        transaction.reference = material;
      } else if (transaction.model_name === "FINISHED_GOOD") {
        const fg = await FinishedGoods.findById(transaction.reference_id)
          .select("name model power type")
          .lean();
        transaction.reference = fg;
      } else if (transaction.model_name === "LEDGER") {
        const ledger = await Ledger.findById(transaction.reference_id)
          .populate("customer_id", "name")
          .select("date type amount details")
          .lean();
        transaction.reference = ledger;
      }
    }

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      transactions,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction by ID
 */
export const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let transaction = await Transaction.findById(id)
      .populate("created_by", "name user_name")
      .lean();

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Manually populate reference_id based on model_name
    if (transaction.model_name === "RAW_MATERIAL") {
      const material = await RawMaterials.findById(transaction.reference_id)
        .select("name type class_type")
        .lean();
      transaction.reference = material;
    } else if (transaction.model_name === "FINISHED_GOOD") {
      const fg = await FinishedGoods.findById(transaction.reference_id)
        .select("name model power type")
        .lean();
      transaction.reference = fg;
    } else if (transaction.model_name === "LEDGER") {
      const ledger = await Ledger.findById(transaction.reference_id)
        .populate("customer_id", "name")
        .select("date type amount details")
        .lean();
      transaction.reference = ledger;
    }

    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};
