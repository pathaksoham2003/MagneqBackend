import RawMaterial from "../models/RawMaterials.js";
import {
  classHeaders,
  filterFieldsByClass,
  validateFieldsByClass,
} from "../utils/helper.js";

export const getRawMaterialById = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({error: "Not found"});
    res.json(material);
  } catch (err) {
    res.status(500).json({error: "Error fetching raw material"});
  }
};

export const getRawMaterialFilterConfig = async (req, res) => {
  try {
    const config = {
      A: {
        names: [],
        types: [],
      },
      B: {
        types: [],
      },
      C: {
        names: [],
      },
    };

    const allMaterials = await RawMaterial.find(
      {},
      "class_type name type"
    ).lean();

    for (const rm of allMaterials) {
      const classType = rm.class_type;
      if (!classType) continue;

      if (classType === "A") {
        if (rm.name && !config.A.names.includes(rm.name)) {
          config.A.names.push(rm.name);
        }
        if (rm.type && !config.A.types.includes(rm.type)) {
          config.A.types.push(rm.type);
        }
      }

      if (classType === "B" && rm.type) {
        if (!config[classType].types.includes(rm.type)) {
          config[classType].types.push(rm.type);
        }
      }

      if (classType === "C" && rm.name) {
        if (rm.name && !config.C.names.includes(rm.name)) {
          config[classType].names.push(rm.name);
        }
      }
    }

    res.status(200).json(config);
  } catch (e) {
    console.error("Error building filter config:", e);
    res.status(500).json({error: "Failed to fetch filter config"});
  }
};

export const getRawMaterialsByClass = async (req, res) => {
  try {
    const { class_type } = req.params;
    const { page = 1, limit = 10, search = "", type = "", name = "" } = req.query;

    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ error: "Invalid class type" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const regexSearch = new RegExp(search, "i");
    const regexType = new RegExp(type, "i");
    const regexName = new RegExp(name, "i");

    const searchQuery = { class_type };

    if (search) {
      searchQuery.$or = [
        { name: { $regex: regexSearch } },
        { type: { $regex: regexSearch } },
      ];
    }

    if (type) {
      searchQuery.type = { $regex: regexType };
    }

    if (name) {
      searchQuery.name = { $regex: regexName };
    }

    const total_items = await RawMaterial.countDocuments(searchQuery);

    const rawMaterials = await RawMaterial.find(searchQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const header = ["Class", "Product Name", "Type", "Quantity"];

    const item = rawMaterials.map((rm) => {
      const quantityStr =
        typeof rm.quantity === "object"
          ? Object.entries(rm.quantity || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : rm.quantity?.toString() || "0";

      return {
        id: rm._id,
        data: [rm.class_type || "", rm.name || "", rm.type || "", quantityStr || "0"],
      };
    });

    const total_pages = Math.ceil(total_items / limit);

    return res.json({
      header,
      item,
      page_no: parseInt(page),
      total_pages,
      total_items,
    });
  } catch (error) {
    console.error("Error fetching raw materials:", error);
    res.status(500).json({ error: "Server error" });
  }
};


export const getFilteredRawMaterials = async (req, res) => {
  try {
    const {class_type, type, model, name} = req.query;

    const filter = {};
    if (class_type) filter.class_type = class_type;
    if (type) filter.type = type;
    if (model) filter.model = model;
    if (name) filter.name = name;

    const rawMaterials = await RawMaterial.find(filter);

    const filteredRawMaterials = rawMaterials.map((material) =>
      filterFieldsByClass(material.class_type, material.toObject())
    );

    res.status(200).json(filteredRawMaterials);
  } catch (err) {
    res.status(500).json({error: err.message});
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
