import RawMaterial from "../models/RawMaterials.js";
import {classHeaders, filterFieldsByClass, validateFieldsByClass} from "../utils/helper.js";

export const getRawMaterialById = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({error: "Not found"});
    res.json(material);
  } catch (err) {
    res.status(500).json({error: "Error fetching raw material"});
  }
};

export const getRawMaterialsByClass = async (req, res) => {
  try {
    const { class_type } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    if (!["A", "B", "C"].includes(class_type)) {
      return res.status(400).json({ error: "Invalid class type" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const regexSearch = new RegExp(search, "i");

    // Handle class B with grouping by product
    if (class_type === "B") {
      const aggregationPipeline = [
        { $match: { class_type: "B", product: { $regex: regexSearch } } },
        {
          $group: {
            _id: "$product",
            class_type: { $first: "$class_type" },
            product: { $first: "$product" },
            quantity: { $sum: "$quantity" },
            status: { $first: "$status" },
            ids: { $addToSet: "$_id" },
          },
        },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ];

      const grouped = await RawMaterial.aggregate(aggregationPipeline);
      const total_items = await RawMaterial.countDocuments({
        class_type: "B",
        product: { $regex: regexSearch },
      });
      const total_pages = Math.ceil(total_items / limit);

      const item = grouped.map((g) => ({
        id: g.ids[0],
        data: [
          g.class_type || "",
          g.product || "",
          g.quantity.toString(),
          g.type || "",
        ],
      }));

      return res.json({
        header: classHeaders.B,
        item,
        page_no: parseInt(page),
        total_pages,
        total_items,
      });
    }

    // Handle class A and C with direct filtering
    const searchQuery = {
      class_type
    };

    const total_items = await RawMaterial.countDocuments(searchQuery);
    const rawMaterials = await RawMaterial.find(searchQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const header = classHeaders[class_type];
    const item = rawMaterials.map((rm) => {
      const filtered = filterFieldsByClass(class_type, rm);

      const dataRow = header.map((label) => {
        switch (label) {
          case "Class":
            return filtered.class_type || "";
          case "Other Specification":
            return filtered.other_specification?.value || "";
          case "Quantity":
            return filtered.quantity?.toString() || "0";
          case "Casting Product":
            return filtered.casting_product || "";
          case "Product":
            return filtered.product || "";
          case "Status":
            return filtered.status || "";
          case "Select Items":
            return Array.isArray(filtered.select_items)
              ? filtered.select_items.join(", ")
              : "";
          case "Expiry Date":
            return filtered.expiry_date
              ? new Date(filtered.expiry_date).toISOString()
              : "";
          default:
            return "";
        }
      });

      return {
        id: rm._id,
        data: dataRow,
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
