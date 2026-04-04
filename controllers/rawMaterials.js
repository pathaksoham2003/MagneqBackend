import RawMaterial from "../models/RawMaterials.js";
import StockHistory from "../models/StockHistory.js";
import logger from "../utils/logger.js";
import {
  classHeaders,
  filterFieldsByClass,
  validateFieldsByClass,
  validateFieldsForUpdate,
} from "../utils/helper.js";

export const getRawMaterialById = async (req, res, next) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Not found" });
    res.json(material);
  } catch (err) {
    next(err);
  }
};

export const getRawMaterialByClassAndId = async (req, res, next) => {
  try {
    const { class_type, id } = req.params;

    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ error: "Invalid class type" });
    }

    const material = await RawMaterial.findOne({
      _id: id,
      class_type: class_type
    });

    if (!material) {
      return res.status(404).json({ error: "Raw material not found" });
    }
    res.json(material);
  } catch (err) {
    next(err);
  }
};

export const getRawMaterialFilterConfig = async (req, res, next) => {
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
    next(e);
  }
};

export const getRawMaterialsByClass = async (req, res, next) => {
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

    // If either name or type is provided, search by both using $or
    if (name || type) {
      searchQuery.$or = [];
      if (name) searchQuery.$or.push({ name: { $regex: regexName } });
      if (type) searchQuery.$or.push({ type: { $regex: regexType } });
    } else if (search) {
      searchQuery.$or = [
        { name: { $regex: regexSearch } },
        { type: { $regex: regexSearch } },
      ];
    }

    const total_items = await RawMaterial.countDocuments(searchQuery);

    const rawMaterials = await RawMaterial.find(searchQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const header = ["Class", "Product Name", "Type", "Quantity", "Stock Status"];

    const item = rawMaterials.map((rm) => {
      let quantityStr =
        typeof rm.quantity === "object"
          ? Object.entries(rm.quantity || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
          : rm.quantity?.toString() || "0";

      // Remove "processed:" prefix for class types A and C
      if ((class_type === "A" || class_type === "C") && quantityStr.includes("processed:")) {
        quantityStr = quantityStr.replace(/processed:\s*/g, "");
      }

      // Calculate stock status
      let currentQuantity = 0;
      let minQuantity = rm.min_quantity || 0;

      if (typeof rm.quantity === 'object' && rm.quantity !== null) {
        currentQuantity = Object.values(rm.quantity).reduce((sum, val) => {
          const numVal = parseFloat(val) || 0;
          return sum + numVal;
        }, 0);
      } else {
        currentQuantity = parseFloat(rm.quantity) || 0;
      }

      // Three-tier stock status logic
      let stockStatus;
      if (currentQuantity === 0) {
        stockStatus = "Out of Stock";
      } else if (currentQuantity > 0 && currentQuantity < minQuantity) {
        stockStatus = "Low Quantity";
      } else {
        stockStatus = "In Stock";
      }

      return {
        id: rm._id,
        data: [
          rm.class_type || "",
          rm.name || "",
          rm.type || "",
          quantityStr || "0",
          stockStatus
        ],
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
    next(error);
  }
};


export const getFilteredRawMaterials = async (req, res, next) => {
  try {
    const { class_type, type, model, name } = req.query;

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
    next(err);
  }
};

export const createRawMaterial = async (req, res, next) => {
  try {
    const { class_type } = req.body;

    if (!class_type) {
      return res.status(400).json({ error: "class_type is required" });
    }

    const material = new RawMaterial(req.body);
    await material.save();
    logger.info(`Raw Material created: ${material.name} (ID: ${material._id})`);
    res.status(201).json({ message: "Raw material created", material });
  } catch (err) {
    next(err);
  }
};

export const updateRawMaterial = async (req, res, next) => {
  try {
    const { class_type } = req.body;

    if (!class_type) {
      return res.status(400).json({ error: "class_type is required" });
    }

    const missingFields = validateFieldsForUpdate(class_type, req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        missingFields,
      });
    }

    const oldMaterial = await RawMaterial.findById(req.params.id);
    const updated = await RawMaterial.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (updated && oldMaterial) {
      // Check if quantity object has changed
      if (req.body.quantity) {
        // Log individual field changes in quantity
        const oldQty = oldMaterial.quantity || {};
        const newQty = updated.quantity || {};
        const fields = Array.from(new Set([...Object.keys(oldQty), ...Object.keys(newQty)]));
        
        for (const field of fields) {
          const oldVal = parseFloat(oldQty[field] || 0);
          const newVal = parseFloat(newQty[field] || 0);
          
          if (oldVal !== newVal) {
            await StockHistory.create({
              raw_material_id: updated._id,
              name: updated.name,
              class_type: updated.class_type,
              category_type: updated.type,
              change_type: "ADMIN_UPDATE",
              quantity_changed: newVal - oldVal,
              sub_type: field,
              current_quantity_snapshot: updated.quantity,
              reference_text: "Admin Manual Overwrite",
              changed_by: req.user ? {
                user_id: req.user.id,
                name: req.user.name,
                user_name: req.user.user_name,
                email: req.user.email
              } : undefined
            });
          }
        }
      }
    }

    if (!updated) {
      return res.status(404).json({ error: "Raw material not found" });
    }

    logger.info(`Raw Material updated: ${updated.name} (ID: ${updated._id})`);
    res.json({ message: "Updated successfully", updated });
  } catch (err) {
    next(err);
  }
};

export const getAllRawMaterials = async (req, res, next) => {
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
    next(err);
  }
};

// @desc Delete raw material by ID
export const deleteRawMaterial = async (req, res, next) => {
  try {
    const deleted = await RawMaterial.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logger.info(`Raw Material deleted: ${req.params.id}`);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// @desc Get stock statistics for raw materials by class type
export const getRawMaterialStockStats = async (req, res, next) => {
  try {
    const stats = {
      A: { inStock: 0, lowQuantity: 0, outOfStock: 0 },
      B: { inStock: 0, lowQuantity: 0, outOfStock: 0 },
      C: { inStock: 0, lowQuantity: 0, outOfStock: 0 }
    };

    const rawMaterials = await RawMaterial.find().lean();

    for (const material of rawMaterials) {
      if (!material.class_type || !["A", "B", "C"].includes(material.class_type)) {
        continue;
      }

      let currentQuantity = 0;
      let minQuantity = material.min_quantity || 0;

      // Calculate current quantity based on class type
      if (typeof material.quantity === 'object' && material.quantity !== null) {
        // For object quantities, sum all values
        currentQuantity = Object.values(material.quantity).reduce((sum, val) => {
          const numVal = parseFloat(val) || 0;
          return sum + numVal;
        }, 0);
      } else {
        // For simple number quantities
        currentQuantity = parseFloat(material.quantity) || 0;
      }

      // Three-tier stock status logic
      if (currentQuantity === 0) {
        stats[material.class_type].outOfStock++;
      } else if (currentQuantity > 0 && currentQuantity < minQuantity) {
        stats[material.class_type].lowQuantity++;
      } else {
        stats[material.class_type].inStock++;
      }
    }

    res.json(stats);
  } catch (err) {
    next(err);
  }
};

export const transitionQuantity = async (req, res, next) => {
  try {
    const { class_type, id } = req.params;
    const { from, to, quantity = 1 } = req.body;

    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ error: "Invalid class type" });
    }

    if (!from || !to || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Invalid from, to, or quantity parameters" });
    }

    const material = await RawMaterial.findOne({ _id: id, class_type: class_type });
    if (!material) {
      return res.status(404).json({ error: "Raw material not found" });
    }

    let qty = material.quantity || {};

    // Check if from field exists and has sufficient quantity
    if (!qty.hasOwnProperty(from)) {
      return res.status(400).json({ error: `Field '${from}' does not exist in quantity object` });
    }

    if ((qty[from] || 0) < quantity) {
      return res.status(400).json({ error: `Insufficient quantity in '${from}' field` });
    }

    // Check if to field exists
    if (!qty.hasOwnProperty(to)) {
      return res.status(400).json({ error: `Field '${to}' does not exist in quantity object` });
    }

    // Perform the transition
    qty[from] = (qty[from] || 0) - quantity;
    qty[to] = (qty[to] || 0) + quantity;

    material.quantity = qty;
    material.markModified('quantity');
    await material.save();

    // Log Stock History for Transition
    await StockHistory.create({
      raw_material_id: material._id,
      name: material.name,
      class_type: material.class_type,
      category_type: material.type,
      change_type: "TRANSITION_UPDATE",
      quantity_changed: quantity, // The amount moved
      sub_type: `${from} to ${to}`,
      current_quantity_snapshot: material.quantity,
      reference_text: `Transitioning ${from} to ${to}`,
      changed_by: req.user ? {
        user_id: req.user.id,
        name: req.user.name,
        user_name: req.user.user_name,
        email: req.user.email
      } : undefined
    });

    logger.info(`Raw Material transition: ${id} (${from} -> ${to})`);
    res.json(material);
  } catch (err) {
    next(err);
  }
};

export const getShortRawMaterialsByClass = async (req, res, next) => {
  try {
    const { class_type } = req.query;
    const { page = 1 } = req.query;
    const limit = 10;
    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ error: "Invalid class type" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch all raw materials of this class
    const rawMaterials = await RawMaterial.find({ class_type }).lean();

    // Filter short items based on rules (Low Quantity and Out of Stock)
    const shortItems = rawMaterials.filter((rm) => {
      let checkQty = 0;

      if (class_type === "A" || class_type === "C") {
        checkQty = rm.quantity?.processed || 0;
      } else if (class_type === "B") {
        checkQty = rm.quantity?.unprocessed || 0;
      }

      const minQty = rm.min_quantity || 0;
      // Include items that are out of stock (0) or low quantity (above 0 but below minimum)
      return checkQty === 0 || (checkQty > 0 && checkQty < minQty);
    });

    const total_items = shortItems.length;
    const total_pages = Math.ceil(total_items / limit);

    // Apply pagination after filtering
    const paginatedItems = shortItems.slice(skip, skip + parseInt(limit));

    // Build response rows
    const header = ["Class", "Product Name", "Type", "Quantity", "Min Quantity"];

    const item = paginatedItems.map((rm) => {
      let quantityStr = "";
      if (typeof rm.quantity === "object") {
        quantityStr = Object.entries(rm.quantity)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
      } else {
        quantityStr = rm.quantity?.toString() || "0";
      }

      return {
        id: rm._id,
        data: [
          rm.class_type || "",
          rm.name || "",
          rm.type || "",
          quantityStr,
          rm.min_quantity?.toString() || "0",
        ],
      };
    });

    return res.json({
      header,
      item,
      page_no: parseInt(page),
      total_pages,
      total_items,
    });
  } catch (error) {
    next(error);
  }
};

export const incrementRejectedQty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qty, class_type } = req.body;
    
    if (!qty || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "Invalid qty provided" });
    }
    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ message: "Invalid class_type provided" });
    }

    const fromField = class_type === "B" ? "quantity.unprocessed" : "quantity.processed";

    // Atomically decrease fromField and increase rejected
    const rawMaterial = await RawMaterial.findOneAndUpdate(
      {
        _id: id,
        [fromField]: { $gte: qty }, // ensure enough stock
      },
      {
        $inc: {
          [fromField]: -qty,
          "quantity.rejected": qty,
        },
      },
      { new: true }
    );

    if (rawMaterial) {
      // Log Stock History for Rejection
      await StockHistory.create({
        raw_material_id: rawMaterial._id,
        name: rawMaterial.name,
        class_type: rawMaterial.class_type,
        category_type: rawMaterial.type,
        change_type: "TRANSITION_UPDATE", // Log as a transition to rejected
        quantity_changed: -qty, // Reduction in primary stock
        sub_type: fromField.split(".").pop(), // "unprocessed" or "processed"
        current_quantity_snapshot: rawMaterial.quantity,
        reference_text: "Stock marked as Rejected",
        changed_by: req.user ? {
          user_id: req.user.id,
          name: req.user.name,
          user_name: req.user.user_name,
          email: req.user.email
        } : undefined
      });
      // Also log the increase in rejected if needed, but the snapshot covers it.
    }

    if (!rawMaterial) {
      return res.status(400).json({ message: "Insufficient stock or raw material not found" });
    }

    logger.info(`Raw Material marked as rejected: ${id} (Qty: ${qty})`);
    return res.status(200).json({
      message: "Rejected quantity updated successfully",
      data: rawMaterial,
    });
  } catch (error) {
    next(error);
  }
};
