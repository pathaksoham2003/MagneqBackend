import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterials from "../models/RawMaterials.js";
import Sales from "../models/Sales.js";

export const getPendingProductionOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    const query = {
      status: { $ne: "READY" },
    };

    if (search) {
      const orderId = parseInt(search);
      if (!isNaN(orderId)) {
        query.order_id = orderId;
      }
    }

    const totalItems = await Production.countDocuments(query);

    const productions = await Production.find(query)
      .populate({
        path: "finished_good",
        populate: {
          path: "raw_materials.raw_material_id",
          model: "RawMaterials",
        },
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const items = productions.map((production) => {
      const fg = production.finished_good;

      const orderDetails = `${fg?.model || "N/A"}/${fg?.type || "N/A"}/${fg?.ratio || "N/A"}`;

      return {
        id: production._id,
        data: [
          `PRO-${production.order_id}`,
          production.customer_name || "Unknown Vendor",
          production.createdAt,
          orderDetails, 
          production.quantity,
          production.status
        ]
      };
    });

    res.status(200).json({
      header: [
        "Production Id",
        "Customer Name",
        "Date of Creation",
        "Order Details",
        "Quantity",
        "Status"
      ],
      item: items,
      page_no: page,
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


export const getProductionDetails = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id).populate(
      "finished_good"
    );
    if (!production)
      return res.status(404).json({ message: "Production not found" });

    const finishedGood = production.finished_good;
    const requiredQuantity = production.quantity || 1;

    const classA = [],
      classB = [],
      classC = [];

    for (const item of finishedGood.raw_materials) {
      const rawMaterial = await RawMaterials.findById(item.raw_material_id);
      if (!rawMaterial) continue;

      const totalRequired = item.quantity * requiredQuantity;
      const isInStock = rawMaterial.quantity >= totalRequired;

      const materialInfo = {
        _id: rawMaterial._id,
        name: rawMaterial.product || "Unnamed",
        required: totalRequired,
        available: rawMaterial.quantity,
        in_stock: isInStock,
      };

      if (rawMaterial.class_type === "A") classA.push(materialInfo);
      else if (rawMaterial.class_type === "B") classB.push(materialInfo);
      else classC.push(materialInfo);
    }

    res.status(200).json({
      production_id: production._id,
      order_id: production.order_id,
      finished_good: {
        model: finishedGood.model,
        type: finishedGood.type,
        ratio: finishedGood.ratio,
      },
      quantity: production.quantity,
      status: production.status,
      created_at: production.created_at,
      updated_at: production.updated_at,
      all_in_stock: [...classA, ...classB, ...classC].every((m) => m.in_stock),
      class_a: classA,
      class_b: classB,
      class_c: classC,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const startProduction = async (req, res) => {
  try {
    const { id } = req.params;

    const production = await Production.findById(id);
    if (!production) {
      return res.status(404).json({ error: "Production not found" });
    }

    if (production.status !== "UN_PROCESSED") {
      return res
        .status(400)
        .json({ error: "Production must be in UN_PROCESSED state" });
    }

    const finishedGood = await FinishedGoods.findById(production.finished_good);
    if (!finishedGood) {
      return res.status(404).json({ error: "Finished good not found" });
    }

    const rawMaterialNeeds = new Map();
    for (const rm of finishedGood.raw_materials) {
      const totalQty = rm.quantity * production.quantity;
      rawMaterialNeeds.set(rm.raw_material_id.toString(), totalQty);
    }

    for (const [rawMaterialId, requiredQty] of rawMaterialNeeds.entries()) {
      const material = await RawMaterials.findById(rawMaterialId);

      if (!material || material.quantity < requiredQty) {
        return res.status(400).json({
          error: `Insufficient raw material: ${rawMaterialId}`,
        });
      }

      material.quantity -= requiredQty;
      material.updated_at = new Date();
      await material.save();
    }

    production.status = "IN_PROCESSES";
    production.updated_at = new Date();
    await production.save();

    res.json({
      message: "Production started, raw materials deducted",
      production,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const makeReady = async (req, res) => {
  try {
    const { id } = req.params;

    const production = await Production.findById(id);
    if (!production)
      return res.status(404).json({ message: "Production not found" });

    production.status = "READY";
    production.updated_at = new Date();
    await production.save();

    await FinishedGoods.findByIdAndUpdate(production.finished_good, {
      $inc: { units: 1 },
    });

    const salesRecord = await Sales.findOne({ order_id: production.order_id });
    if (salesRecord) {
      const fgItem = salesRecord.finished_goods.find(
        (item) =>
          item.finished_good.toString() ===
          production.finished_good.toString()
      );
      if (fgItem) {
        fgItem.status = true;
      }

      const allProcessed = salesRecord.finished_goods.every(
        (item) => item.status === true
      );
      if (allProcessed) {
        salesRecord.status = "PROCESSED";
      }

      await salesRecord.save();
    }

    res
      .status(200)
      .json({ message: "Production marked as READY and updates applied" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
