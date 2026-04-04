import FinishedGoods from "../models/FinishedGoods.js";
import Sales from "../models/Sales.js";
import mongoose from "mongoose";
import {getFgModelNumber} from "../utils/helper.js";
import logger from "../utils/logger.js";

// Helper function to check if finished good is used in pending sales orders
const checkPendingSalesOrders = async (finishedGoodId) => {
  try {
    // Find sales orders that are not completed (not PROCESSED, DELIVERED, or CANCELLED)
    // and contain the finished good
    const pendingSales = await Sales.find({
      status: { $nin: ["PROCESSED", "DELIVERED", "CANCELLED"] },
      "finished_goods.finished_good": finishedGoodId
    }).select("order_id status customer_name");

    if (pendingSales.length > 0) {
      const salesInfo = pendingSales.map(sale => ({
        order_id: sale.order_id,
        status: sale.status,
        customer_name: sale.customer_name
      }));
      
      return {
        hasPending: true,
        salesOrders: salesInfo
      };
    }

    return { hasPending: false, salesOrders: [] };
  } catch (error) {
    throw error;
  }
};

export const createFinishedGood = async (req, res, next) => {
  try {
    const {
      model,
      power,
      ratio,
      type,
      rate_per_unit ="0" ,
      base_price ,
      gst_slab,
      other_specification
    } = req.body;
    if (!power || !ratio || !type || !model || !gst_slab) {
      return res.status(400).json({
        error: "Power, ratio, and type are required to generate model number.",
      });
    }

    const model_number = getFgModelNumber(req.body);

    if (!model_number) {
      return res.status(400).json({
        error: "Failed to generate a model number from the input data.",
      });
    }

    const allFinishedGoods = await FinishedGoods.find();
    const isDuplicate = allFinishedGoods.some((fg) => {
      const existingModelNumber = getFgModelNumber(fg);
      return (
        existingModelNumber === model_number &&
        (fg.power || "").trim() === power.trim()
      );
    });

    if (isDuplicate) {
      return res.status(409).json({
        error: "A finished good with the same model number already exists.",
        model_number,
      });
    }

    const newFG = new FinishedGoods({
      model: model.trim(),
      power: power.trim(), // now just string
      ratio: ratio.toString().trim(),
      type: type.trim(),
      rate_per_unit: mongoose.Types.Decimal128.fromString(rate_per_unit.toString()),
      base_price: mongoose.Types.Decimal128.fromString(base_price.toString()),
      gst_slab:gst_slab,
      other_specification: other_specification,
      units: 0,
    });

    const savedFG = await newFG.save();

    logger.info(`Finished Good created: ${model_number} (ID: ${savedFG._id})`);
    return res.status(201).json(savedFG);
  } catch (error) {
    next(error);
  }
};


export const getAllFinishedGoods = async (req, res, next) => {
  try {
    const finishedGoods = await FinishedGoods.find().populate(
      "raw_materials.raw_material_id"
    );
    res.status(200).json(finishedGoods);
  } catch (error) {
    next(error);
  }
};

export const getFinishedGoodById = async (req, res, next) => {
  try {
    const fg = await FinishedGoods.findById(req.params.id).populate(
      "raw_materials.raw_material_id"
    );

    if (!fg) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    const { model, type, ratio, power, other_specification = {} } = fg;

    // Generate FG Model Number
    const model_number = getFgModelNumber(fg);

    // Separate raw materials by class with quantity
    const classA = [];
    const classB = [];
    const classC = [];

    (fg.raw_materials || []).forEach((rm) => {
      const material = rm.raw_material_id;
      if (!material) return;

      const item = {
        raw_material: {
          _id: material._id,
          name: material.name,
          type: material.type,
        },
        quantity: rm.quantity || 0,
      };

      if (material.class_type === "A") {
        classA.push(item);
      } else if (material.class_type === "B") {
        classB.push(item);
      } else if (material.class_type === "C") {
        classC.push(item);
      }
    });

    res.status(200).json({
      model,
      type,
      ratio,
      power: power || "", // No `.toString()` needed
      model_number,
      classA,
      classB,
      classC,
      other_specification,
      units: fg.units || 0,
      base_price: fg.base_price ? parseFloat(fg.base_price.toString()) : 0,
      gst_slab: fg.gst_slab ? parseFloat(fg.gst_slab.toString()) : 0,
    });
  } catch (error) {
    next(error);
  }
};


export const updateFinishedGood = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { classA = [], classB = [], classC = [] } = req.body;

    // Check if finished good exists
    const currentFG = await FinishedGoods.findById(id);
    if (!currentFG) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    // Check if finished good is used in pending sales orders
    const pendingCheck = await checkPendingSalesOrders(id);
    if (pendingCheck.hasPending) {
      return res.status(400).json({
        error: "Cannot update finished good. It is currently used in pending sales orders.",
        message: "Please complete or cancel the following sales orders before updating this finished good:",
        pendingSalesOrders: pendingCheck.salesOrders
      });
    }

    // Combine and sanitize raw materials
    const allRawMaterials = [...classA, ...classB, ...classC];

    const raw_materials = allRawMaterials
      .filter(item => item.raw_material) // ignore invalid items
      .map(item => ({
        raw_material_id: item.raw_material,
        quantity: Number(item.quantity) || 0, // ensure quantity is a number
      }));

    const updatedFG = await FinishedGoods.findByIdAndUpdate(
      id,
      { raw_materials },
      { new: true }
    ).populate("raw_materials.raw_material_id");

    logger.info(`Finished Good raw materials updated: ${id}`);
    res.status(200).json(updatedFG);
  } catch (error) {
    next(error);
  }
};

export const updateFinishedGoodDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      model,
      power,
      ratio,
      type,
      base_price,
      gst_slab,
      other_specification
    } = req.body;

    if (!power || !ratio || !type || !model || !gst_slab) {
      return res.status(400).json({
        error: "Model, Power, Type, Ratio, and GST slab are required.",
      });
    }

    const currentFG = await FinishedGoods.findById(id);
    
    if (!currentFG) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    // Check if finished good is used in pending sales orders
    const pendingCheck = await checkPendingSalesOrders(id);
    if (pendingCheck.hasPending) {
      return res.status(400).json({
        error: "Cannot update finished good. It is currently used in pending sales orders.",
        message: "Please complete or cancel the following sales orders before updating this finished good:",
        pendingSalesOrders: pendingCheck.salesOrders
      });
    }

    // Check for duplicate model number (excluding current record)
    const allFinishedGoods = await FinishedGoods.find({ _id: { $ne: id } });

    const updatedData = {
      model: model.trim(),
      power: power.trim(),
      ratio: ratio.toString().trim(),
      type: type.trim(),
      base_price: mongoose.Types.Decimal128.fromString(base_price.toString()),
      gst_slab: gst_slab,
      other_specification: other_specification,
    };

    // Check for duplicate model number
    const isDuplicate = allFinishedGoods.some((fg) => {
      const existingModelNumber = getFgModelNumber(fg);
      const newModelNumber = getFgModelNumber({ ...currentFG.toObject(), ...updatedData });
      return (
        existingModelNumber === newModelNumber &&
        (fg.power || "").trim() === power.trim()
      );
    });

    if (isDuplicate) {
      return res.status(409).json({
        error: "A finished good with the same model number already exists.",
      });
    }

    const updatedFG = await FinishedGoods.findByIdAndUpdate(
      id,
      updatedData,
      { new: true }
    ).populate("raw_materials.raw_material_id");

    logger.info(`Finished Good details updated: ${id} (${updatedData.model})`);
    res.status(200).json({
      message: "Finished good updated successfully",
      finishedGood: updatedFG
    });
  } catch (error) {
    next(error);
  }
};


export const deleteFinishedGood = async (req, res, next) => {
  try {
    const deletedFG = await FinishedGoods.findByIdAndDelete(req.params.id);
    logger.info(`Finished Good deleted: ${req.params.id}`);
    res.status(200).json({message: "Finished good deleted successfully"});
  } catch (error) {
    next(error);
  }
};

export const getModelConfig = async (req, res, next) => {
  try {
    const finishedGoods = await FinishedGoods.aggregate([
      {
        $group: {
          _id: {
            model: "$model",
            power: "$power",
            ratio: "$ratio",
            type: "$type"
          },
        },
      },
      {
        $group: {
          _id: "$_id.model",
          powers: {$addToSet: "$_id.power"},
          power_ratios: {
            $push: {
              power: "$_id.power",
              ratio: "$_id.ratio",
              type: "$_id.type",
            },
          },
        },
      },
    ]);

    const config = {};
    for (const fg of finishedGoods) {
      const model = fg._id;
      config[model] = {
        powers: fg.powers.sort(),
        ratios: {},
      };

      for (const pr of fg.power_ratios) {
        const powerKey = pr.power;
        if (!config[model].ratios[powerKey]) {
          config[model].ratios[powerKey] = [];
        }
        if (!config[model].ratios[powerKey].includes(pr.ratio)) {
          config[model].ratios[powerKey].push(pr.ratio);
        }
      }
    }

    res.json(config);
  } catch (err) {
    next(err);
  }
};
