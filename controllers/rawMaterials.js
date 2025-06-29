import RawMaterial from "../models/RawMaterials.js";
import {filterFieldsByClass, validateFieldsByClass} from "../utils/helper.js";

export const getRawMaterialById = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({error: "Not found"});
    res.json(material);
  } catch (err) {
    res.status(500).json({error: "Error fetching raw material"});
  }
};

export const getFilteredRawMaterials = async (req, res) => {
  try {
    const {
      class_type,
      type,
      model,
      product,
      casting_product,
    } = req.query;

    const filter = {};
    if (class_type) filter.class_type = class_type;
    if (type) filter.type = type;
    if (model) filter.model = model;
    if (product) filter.product = product;
    if (casting_product) filter.casting_product = casting_product;

    const rawMaterials = await RawMaterial.find(filter);

    const filteredRawMaterials = rawMaterials.map((material) =>
      filterFieldsByClass(material.class_type, material.toObject())
    );

    res.status(200).json(filteredRawMaterials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRawMaterial = async (req, res) => {
  try {
    const {class_type} = req.body;

    if (!class_type) {
      return res.status(400).json({error: "class_type is required"});
    }

    const missingFields = validateFieldsByClass(class_type, req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        missingFields,
      });
    }

    const material = new RawMaterial(req.body);
    await material.save();
    res.status(201).json({message: "Raw material created", material});
  } catch (err) {
    res.status(400).json({error: "Creation failed", details: err.message});
  }
};

export const updateRawMaterial = async (req, res) => {
  try {
    const {class_type} = req.body;

    if (!class_type) {
      return res.status(400).json({error: "class_type is required"});
    }

    const missingFields = validateFieldsByClass(class_type, req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        missingFields,
      });
    }

    const updated = await RawMaterial.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (!updated) {
      return res.status(404).json({error: "Raw material not found"});
    }

    res.json({message: "Updated successfully", updated});
  } catch (err) {
    res.status(400).json({error: "Update failed", details: err.message});
  }
};

export const getAllRawMaterials = async (req, res) => {
  try {
    const all = await RawMaterial.find();

    const grouped = {
      A: [],
      B: [],
      C: [],
    };

    for (const item of all) {
      const type = item.class_type;
      if (["A", "B", "C"].includes(type)) {
        grouped[type].push(filterFieldsByClass(type, item.toObject()));
      }
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({error: "Failed to fetch raw materials"});
  }
};

// @desc Delete raw material by ID
export const deleteRawMaterial = async (req, res) => {
  try {
    const deleted = await RawMaterial.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({error: "Not found"});
    res.json({message: "Deleted successfully"});
  } catch (err) {
    res.status(400).json({error: "Delete failed", details: err.message});
  }
};
