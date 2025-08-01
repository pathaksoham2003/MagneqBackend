import FinishedGoods from "../models/FinishedGoods.js";
import mongoose from "mongoose";
import {getFgModelNumber} from "../utils/helper.js";

export const createFinishedGood = async (req, res) => {
  try {
    const {
      model,
      power,
      ratio,
      type,
      other_specification = {},
      rate_per_unit = "0",
      base_price = "0",
    } = req.body;

    if (!power || !ratio || !type || !model) {
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
      other_specification,
      rate_per_unit: mongoose.Types.Decimal128.fromString(rate_per_unit.toString()),
      base_price: mongoose.Types.Decimal128.fromString(base_price.toString()),
      units: 0,
    });

    const savedFG = await newFG.save();

    return res.status(201).json(savedFG);
  } catch (error) {
    console.error("Error creating finished good:", error);
    return res.status(500).json({ error: error.message });
  }
};


export const getAllFinishedGoods = async (req, res) => {
  try {
    const finishedGoods = await FinishedGoods.find().populate(
      "raw_materials.raw_material_id"
    );
    res.status(200).json(finishedGoods);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
};

export const getFinishedGoodById = async (req, res) => {
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
      motor_shaft_diameter: other_specification.motor_shaft_diameter || "",
      motor_frame_size: other_specification.motor_frame_size || "",
      rpm: other_specification.rpm || "",
      nm: other_specification.nm || "",
      sf: other_specification.sf || "",
      overhead_load: other_specification.overhead_load || "",
      classA,
      classB,
      classC,
    });
  } catch (error) {
    console.error("Error in getFinishedGoodById:", error);
    res.status(500).json({ error: error.message });
  }
};


export const updateFinishedGood = async (req, res) => {
  try {
    const { id } = req.params;
    const { classA = [], classB = [], classC = [] } = req.body;

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

    if (!updatedFG) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    res.status(200).json(updatedFG);
  } catch (error) {
    console.error("Error updating finished good:", error);
    res.status(400).json({ error: error.message });
  }
};


export const deleteFinishedGood = async (req, res) => {
  try {
    const deletedFG = await FinishedGoods.findByIdAndDelete(req.params.id);
    if (!deletedFG) {
      return res.status(404).json({message: "Finished good not found"});
    }
    res.status(200).json({message: "Finished good deleted successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
};

export const getModelConfig = async (req, res) => {
  try {
    const finishedGoods = await FinishedGoods.aggregate([
      {
        $group: {
          _id: {
            model: "$model",
            power: "$power",
            ratio: "$ratio",
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
    console.error(err);
    res.status(500).json({error: "Failed to fetch model config"});
  }
};
