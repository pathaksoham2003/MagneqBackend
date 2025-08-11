import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterials from "../models/RawMaterials.js";
import Sales from "../models/Sales.js";
import {getFgModelNumber, getModelNumber} from "../utils/helper.js";

export const createProductionOrder = async(req,res) => {
  try{
    let productionData = {
      ...req.body,
      status: "UN_PROCESSED",
    };
    const productionRecords = [];
    for (let item of productionData.finished_goods) {
      const {model, type, ratio, power, quantity} = item;
      const finishedGood = await FinishedGoods.findOne({
        model,
        type,
        ratio,
        power,
      });
    
      if (!finishedGood) {
        return res.status(404).json({
          error: `Finished good not found for model: ${model}, type: ${type}, ratio: ${ratio}, power: ${power}`,
        });
      }
      const production = new Production({
        customer_name: "N / A",
        finished_good: finishedGood._id,
        quantity: quantity,
        status: "UN_PROCESSED",
        isProduction: true,
      });
      await production.save();
      productionRecords.push(production);  
    }
    res.status(200).json({message:"Production order creted successfully",productions: productionRecords})
  }catch(err){
    res.status(500).json({error: err.message});
  }
}

export const getPendingProductionOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    const query = {
      status: {$ne: "READY"},
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
      .sort({createdAt: -1});

    const items = productions.map((production) => {
      const fg = production.finished_good;
      const orderDetails = getFgModelNumber(fg);

      let statusDetail = null;

      if (production.status === "UN_PROCESSED") {
        // For class A and B check processed quantity only
        const allAvailable = fg.raw_materials.every((rm) => {
          const material = rm.raw_material_id;
          if (!material || typeof material.quantity !== "object") return false;

          // Use quantity.processed for class A and B
          const availableQty = material.quantity.processed || 0;

          return availableQty >= rm.quantity;
        });

        statusDetail = allAvailable ? "IN_STOCK" : "NOT_IN_STOCK";
      }

      return {
        id: production._id,
        data: [
          `PRO-${production.pro_id}(SO-${production.order_id})`,
          production.customer_name || "Unknown Vendor",
          production.createdAt,
          orderDetails,
          production.quantity,
          production.status === "UN_PROCESSED"
            ? statusDetail
            : production.status,
        ],
      };
    });

    res.status(200).json({
      header: [
        "Production Id / Sales Id",
        "Customer Name",
        "Date of Creation",
        "Order Details",
        "Quantity",
        "Status",
      ],
      item: items,
      page_no: page,
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
};

export const getProductionDetails = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id).populate(
      "finished_good"
    );
    if (!production)
      return res.status(404).json({message: "Production not found"});

    const finishedGood = production.finished_good;
    const requiredQuantity = production.quantity || 1;

    const classA = [],
      classB = [],
      classC = [];

    for (const item of finishedGood.raw_materials) {
      const rawMaterial = await RawMaterials.findById(item.raw_material_id);
      if (!rawMaterial || typeof rawMaterial.quantity !== "object") continue;

      const totalRequired = item.quantity * requiredQuantity;

      // For class A and B use processed quantity for stock check
      const availableQty = rawMaterial.quantity.processed || 0;

      const isInStock = availableQty >= totalRequired;

      const materialInfo = {
        _id: rawMaterial._id,
        name: `${rawMaterial.name} | ${rawMaterial.type}` || "Unnamed",
        required: totalRequired,
        available: availableQty,
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
        model: getModelNumber(finishedGood.model),
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
    res.status(500).json({error: err.message});
  }
};

export const startProduction = async (req, res) => {
  try {
    const {id} = req.params;

    const production = await Production.findById(id);
    if (!production) {
      return res.status(404).json({error: "Production not found"});
    }

    if (production.status !== "UN_PROCESSED") {
      return res
        .status(400)
        .json({error: "Production must be in UN_PROCESSED state"});
    }

    const finishedGood = await FinishedGoods.findById(production.finished_good);
    if (!finishedGood) {
      return res.status(404).json({error: "Finished good not found"});
    }

    // Loop over each raw_material reference manually
    for (const rm of finishedGood.raw_materials) {
      const material = await RawMaterials.findById(rm.raw_material_id);
      if (!material || typeof material.quantity !== "object") {
        return res.status(400).json({error: "Invalid raw material found"});
      }

      const classType = material.class_type;
      const requiredQty = rm.quantity * production.quantity;

      if (["A", "B", "C"].includes(classType)) {
        const availableQty = material.quantity.processed || 0;

        if (availableQty < requiredQty) {
          return res.status(400).json({
            error: `Insufficient processed quantity for material: ${
              material.name || "Unnamed"
            }`,
          });
        }

        // Reduce processed quantity
        material.quantity.processed = availableQty - requiredQty;
        material.updated_at = new Date();

        // Mark the quantity field as modified
        material.markModified("quantity");
        await material.save();
      }
    }

    // Update production
    production.status = "IN_PROCESSES";
    production.updated_at = new Date();
    await production.save();

    res.json({
      message: "Production started, raw materials updated successfully",
      production,
    });
  } catch (err) {
    console.error("Start Production Error:", err);
    res.status(500).json({error: err.message});
  }
};

export const makeReady = async (req, res) => {
  try {
    const { id } = req.params;

    const production = await Production.findById(id);
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    await FinishedGoods.findByIdAndUpdate(production.finished_good, {
      $inc: { units: 1 },
    });

    if (production.isProduction) {
      production.status = "COMPLETED";
      production.updated_at = new Date();
      await production.save();

      return res.status(200).json({
        message: "Standalone production marked as COMPLETED.",
      });
    } else {
      production.status = "READY";
      production.updated_at = new Date();
      await production.save();

      const salesRecord = await Sales.findOne({
        order_id: production.order_id,
      });

      if (salesRecord) {
        const fgItem = salesRecord.finished_goods.find(
          (item) =>
            item.finished_good.toString() === production.finished_good.toString()
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

      return res.status(200).json({
        message: "Production marked as READY and sales order updated.",
      });
    }
  } catch (err) {
    console.error("Error in makeReady:", err);
    return res.status(500).json({ error: err.message });
  }
};
