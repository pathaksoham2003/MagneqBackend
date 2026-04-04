import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterials from "../models/RawMaterials.js";
import Sales from "../models/Sales.js";
import { getFgModelNumber, getModelNumber } from "../utils/helper.js";
import FgHistory from "../models/FgHistory.js";
import ProductionHistory from "../models/ProductionHistory.js";
import StockHistory from "../models/StockHistory.js";
import logger from "../utils/logger.js";

export const createProductionOrder = async (req, res, next) => {
  try {
    let productionData = {
      ...req.body,
      status: "UN_PROCESSED",
    };
    const productionRecords = [];
    for (let item of productionData.finished_goods) {
      const { model, type, ratio, power, quantity } = item;
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
      });
      await production.save();
      productionRecords.push(production);
    }
    logger.info(`Production order created with ${productionRecords.length} items`);
    res
      .status(200)
      .json({
        message: "Production order creted successfully",
        productions: productionRecords,
      });
  } catch (err) {
    next(err);
  }
};

export const getPendingProductionOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    const query = {
      $or: [
        { produced_quantity: { $gt: 0 } },
        { production_quantity: { $gt: 0 } },
      ],
    };

    if (search) {
      const orderId = parseInt(search);
      if (!isNaN(orderId)) {
        query.order_id = orderId;
      }
    }

    // Get all productions without pagination first
    const productions = await Production.find(query)
      .populate({
        path: "finished_good",
        populate: {
          path: "raw_materials.raw_material_id",
          model: "RawMaterials",
        },
      })
      .sort({ createdAt: -1 });

    // Map and filter items first
    const allItems = productions.map((production) => {
      const fg = production.finished_good;
      const orderDetails = getFgModelNumber(fg);

      const totalQty = (production.production_quantity || 0) + (production.produced_quantity || 0);
      const pendingQty = totalQty - (fg.units || 0);

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
          orderDetails,
          totalQty, // Total Production Quantity
          pendingQty, // Production Pending Quantity
          fg.units || 0, // Current FG Stock Quantity
        ],
      };
    }).filter(item => item.data[2] > 0);

    // Apply pagination after filtering
    const totalItems = allItems.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = allItems.slice(startIndex, endIndex);

    res.status(200).json({
      header: [
        "Finished Good",
        "Total Sales Quantity",
        "Production Pending Quantity",
        "Current FG Stock Quantity",
      ],
      item: items,
      page_no: page,
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getPendingProductionOrdersFromSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    // Get all sales orders with INPROCESS status
    let salesQuery = { status: "INPROCESS" };

    if (search) {
      const orderId = parseInt(search);
      if (!isNaN(orderId)) {
        salesQuery.order_id = orderId;
      }
    }

    const salesOrders = await Sales.find(salesQuery)
      .populate({
        path: "finished_goods.finished_good",
        model: "FinishedGoods",
      })
      .sort({ createdAt: -1 });

    // Group finished goods and sum their sales quantities
    const fgSalesMap = new Map(); // Map<finished_good_id, {fg, totalSalesQuantity}>

    for (const salesOrder of salesOrders) {
      for (const salesItem of salesOrder.finished_goods) {
        // Handle both populated and non-populated cases
        let finishedGoodId;
        let finishedGood;

        if (salesItem.finished_good) {
          if (typeof salesItem.finished_good === 'object' && salesItem.finished_good._id) {
            // Populated
            finishedGoodId = salesItem.finished_good._id;
            finishedGood = salesItem.finished_good;
          } else if (typeof salesItem.finished_good === 'object') {
            // ObjectId as object
            finishedGoodId = salesItem.finished_good;
            finishedGood = null;
          } else {
            // ObjectId as string
            finishedGoodId = salesItem.finished_good;
            finishedGood = null;
          }
        }

        if (!finishedGoodId) continue;

        // If finished good wasn't populated, fetch it
        if (!finishedGood) {
          finishedGood = await FinishedGoods.findById(finishedGoodId);
          if (!finishedGood) continue;
        }

        // Calculate remaining sales quantity: order quantity - invoiced quantity
        const orderQuantity = salesItem.quantity || 0;
        const invoicedQuantity = salesItem.invoiced_quantity || 0;
        const remainingSalesQuantity = Math.max(0, orderQuantity - invoicedQuantity);

        if (remainingSalesQuantity > 0) {
          if (fgSalesMap.has(finishedGoodId.toString())) {
            // Add to existing entry
            const existing = fgSalesMap.get(finishedGoodId.toString());
            existing.totalSalesQuantity += remainingSalesQuantity;
          } else {
            // Create new entry
            fgSalesMap.set(finishedGoodId.toString(), {
              fg: finishedGood,
              totalSalesQuantity: remainingSalesQuantity,
            });
          }
        }
      }
    }

    // Convert map to array and calculate production required
    const allItems = [];
    for (const [finishedGoodId, { fg, totalSalesQuantity }] of fgSalesMap.entries()) {
      // Get current FG units
      const currentUnits = fg.units || 0;

      // Calculate production required: total sales quantity - current FG units
      const productionRequired = Math.max(0, totalSalesQuantity - currentUnits);

      // Only include items with production required > 0
      if (productionRequired > 0) {
        const orderDetails = getFgModelNumber(fg);

        allItems.push({
          id: fg._id,
          data: [
            orderDetails, // Finished Good
            totalSalesQuantity, // Total Sales Quantity
            productionRequired, // Production Pending Quantity
            currentUnits, // Current FG Stock Quantity
          ],
        });
      }
    }

    // Apply pagination after filtering
    const totalItems = allItems.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = allItems.slice(startIndex, endIndex);

    res.status(200).json({
      header: [
        "Finished Good",
        "Total Sales Quantity",
        "Production Pending Quantity",
        "Current FG Stock Quantity",
      ],
      item: items,
      page_no: page,
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getProductionDetails = async (req, res, next) => {
  try {
    const production = await Production.findOne({
      finished_good: req.params.id
    }).populate("finished_good");
    if (!production)
      return res.status(404).json({ message: "Production not found" });

    const finishedGood = production.finished_good;

    // Get all sales orders with INPROCESS status for this finished good
    const salesOrders = await Sales.find({
      status: "INPROCESS",
      "finished_goods.finished_good": finishedGood._id,
    });

    let totalSalesQuantity = 0;
    for (const salesOrder of salesOrders) {
      for (const salesItem of salesOrder.finished_goods) {
        const itemFgId = salesItem.finished_good?._id || salesItem.finished_good;
        if (itemFgId && itemFgId.toString() === finishedGood._id.toString()) {
          const orderQuantity = salesItem.quantity || 0;
          const invoicedQuantity = salesItem.invoiced_quantity || 0;
          const remainingSalesQuantity = Math.max(0, orderQuantity - invoicedQuantity);
          totalSalesQuantity += remainingSalesQuantity;
        }
      }
    }

    const requiredQuantity = Math.max(0, totalSalesQuantity - (finishedGood.units || 0));

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
      pro_id: production.pro_id,
      finished_good: {
        model: getModelNumber(finishedGood.model),
        type: finishedGood.type,
        ratio: finishedGood.ratio,
        units: finishedGood.units || 0,
      },
      quantity: production.quantity,
      production_quantity: production.production_quantity,
      produced_quantity: production.produced_quantity,
      total_sales_quantity: totalSalesQuantity,
      production_pending_quantity: requiredQuantity,
      status: production.status,
      created_at: production.created_at,
      updated_at: production.updated_at,
      all_in_stock: [...classA, ...classB, ...classC].every((m) => m.in_stock),
      class_a: classA,
      class_b: classB,
      class_c: classC,
    });
  } catch (err) {
    next(err);
  }
};

export const startProduction = async (req, res, next) => {
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

    // Loop over each raw_material reference manually
    for (const rm of finishedGood.raw_materials) {
      const material = await RawMaterials.findById(rm.raw_material_id);
      if (!material || typeof material.quantity !== "object") {
        return res.status(400).json({ error: "Invalid raw material found" });
      }

      const classType = material.class_type;
      const requiredQty = rm.quantity * production.quantity;

      if (["A", "B", "C"].includes(classType)) {
        const availableQty = material.quantity.processed || 0;

        if (availableQty < requiredQty) {
          return res.status(400).json({
            error: `Insufficient processed quantity for material: ${material.name || "Unnamed"
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

    logger.info(`Production started: ${id}`);
    res.json({
      message: "Production started, raw materials updated successfully",
      production,
    });
  } catch (err) {
    next(err);
  }
};

export const makeReady = async (req, res, next) => {
  try {
    const { id } = req.params;

    const production = await Production.findById(id);
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    await FinishedGoods.findByIdAndUpdate(production.finished_good, {
      $inc: { units: 1 },
    });

    production.status = "COMPLETED";
    production.updated_at = new Date();
    await production.save();

    logger.info(`Production marked as ready/completed: ${id}`);
    return res.status(200).json({
      message: "Production marked as COMPLETED.",
    });
  } catch (err) {
    next(err);
  }
};


// Helper function to ensure only one production record per finished good
const ensureSingleProductionPerFinishedGood = async (finishedGoodId) => {
  const productions = await Production.find({
    finished_good: finishedGoodId
  });

  if (productions.length > 1) {
    // Merge all production records into the first one
    const mainProduction = productions[0];
    const otherProductions = productions.slice(1);

    // Sum up all quantities
    let totalOrderQuantity = mainProduction.order_quantity;
    let totalQuantity = mainProduction.quantity;
    let totalProductionQuantity = mainProduction.production_quantity;
    let totalProducedQuantity = mainProduction.produced_quantity;

    for (const prod of otherProductions) {
      totalOrderQuantity += prod.order_quantity || 0;
      totalQuantity += prod.quantity || 0;
      totalProductionQuantity += prod.production_quantity || 0;
      totalProducedQuantity += prod.produced_quantity || 0;
    }

    // Update main production record
    mainProduction.order_quantity = totalOrderQuantity;
    mainProduction.quantity = totalQuantity;
    mainProduction.production_quantity = totalProductionQuantity;
    mainProduction.produced_quantity = totalProducedQuantity;
    mainProduction.updated_at = new Date();
    await mainProduction.save();

    // Delete other production records
    await Production.deleteMany({
      _id: { $in: otherProductions.map(p => p._id) }
    });

    return mainProduction;
  }

  return productions[0] || null;
};

// Add daily production directly to finished goods (allows excess production)
export const addDailyProduction = async (req, res, next) => {
  try {
    const { finished_goods, date } = req.body;
    const historyDate = date ? new Date(date) : new Date();

    if (!finished_goods || !Array.isArray(finished_goods) || finished_goods.length === 0) {
      return res.status(400).json({
        error: "Finished goods array is required and must not be empty"
      });
    }

    const results = [];
    const errors = [];

    for (const item of finished_goods) {
      const { model, type, ratio, power, quantity } = item;

      if (!model || !type || !ratio || !power || !quantity) {
        const itemIdentifier = `${model || 'N/A'}-${type || 'N/A'}-${ratio || 'N/A'}-${power || 'N/A'}`;
        errors.push({
          item: { model, type, ratio, power, quantity },
          itemIdentifier: itemIdentifier,
          error: `Missing required fields for ${itemIdentifier}. All fields (model, type, ratio, power, quantity) are required`
        });
        continue;
      }

      if (quantity <= 0) {
        const itemIdentifier = `${model}-${type}-${ratio}-${power}`;
        errors.push({
          item: { model, type, ratio, power, quantity },
          itemIdentifier: itemIdentifier,
          error: `Invalid quantity for ${itemIdentifier}. Quantity must be greater than 0`
        });
        continue;
      }

      // Find the finished good
      const finishedGood = await FinishedGoods.findOne({
        model,
        type,
        ratio,
        power,
      });

      if (!finishedGood) {
        const itemIdentifier = `${model}-${type}-${ratio}-${power}`;
        errors.push({
          item: { model, type, ratio, power, quantity },
          itemIdentifier: itemIdentifier,
          error: `Finished good not found: ${itemIdentifier}`
        });
        continue;
      }

      // Check raw material availability and calculate maximum producible quantity
      let maxProducibleQuantity = Infinity;
      const rawMaterialDeductions = [];
      const rawMaterialLimits = [];

      for (const rm of finishedGood.raw_materials) {
        const material = await RawMaterials.findById(rm.raw_material_id);
        if (!material || typeof material.quantity !== "object") {
          const itemIdentifier = `${model}-${type}-${ratio}-${power}`;
          errors.push({
            item: { model, type, ratio, power, quantity },
            itemIdentifier: itemIdentifier,
            error: `Invalid raw material in BOM for ${itemIdentifier}: ${material?.name || 'Unknown'}`
          });
          maxProducibleQuantity = 0;
          break;
        }

        const availableQty = material.quantity.processed || 0;
        const maxFromThisMaterial = Math.floor(availableQty / rm.quantity);

        rawMaterialLimits.push({
          material: `${material.name} | ${material.type}` || 'Unknown',
          available: availableQty,
          requiredPerUnit: rm.quantity,
          maxProducible: maxFromThisMaterial
        });

        maxProducibleQuantity = Math.min(maxProducibleQuantity, maxFromThisMaterial);
      }

      // Check if we can produce the requested quantity
      if (maxProducibleQuantity < quantity) {
        const limitingMaterials = rawMaterialLimits.filter(rm => rm.maxProducible < quantity);
        const limitingMaterialNames = limitingMaterials.map(rm => `${rm.material} (max: ${rm.maxProducible})`).join(', ');

        const itemIdentifier = `${model}-${type}-${ratio}-${power}`;
        errors.push({
          item: { model, type, ratio, power, quantity },
          itemIdentifier: itemIdentifier,
          error: `Insufficient BOM materials for ${itemIdentifier}. Requested: ${quantity}, Maximum producible: ${maxProducibleQuantity}. Limiting materials: ${limitingMaterialNames}`,
          maxProducible: maxProducibleQuantity,
          rawMaterialLimits: rawMaterialLimits,
          requestedQuantity: quantity
        });
        continue;
      }

      // Prepare raw material deductions
      for (const rm of finishedGood.raw_materials) {
        const material = await RawMaterials.findById(rm.raw_material_id);
        const requiredQty = rm.quantity * quantity;
        const availableQty = material.quantity.processed || 0;

        rawMaterialDeductions.push({
          material,
          requiredQty,
          availableQty
        });
      }

      // Create Production History first to get its ID for linkage
      const productionHistory = await ProductionHistory.create({
        finished_good_id: finishedGood._id,
        model: finishedGood.model,
        type: finishedGood.type,
        quantity_produced: quantity,
        reference_text: `Daily Production Entry`,
        changed_by: req.user ? {
          user_id: req.user.id,
          name: req.user.name,
          user_name: req.user.user_name,
          email: req.user.email
        } : undefined,
        date: historyDate
      });

      const currentRawMaterialsUsed = [];

      // Deduct raw materials
      for (const deduction of rawMaterialDeductions) {
        deduction.material.quantity.processed = deduction.availableQty - deduction.requiredQty;
        deduction.material.updated_at = new Date();
        deduction.material.markModified("quantity");
        await deduction.material.save();

        currentRawMaterialsUsed.push({
          raw_material_id: deduction.material._id,
          name: deduction.material.name,
          class_type: deduction.material.class_type,
          quantity_consumed: deduction.requiredQty
        });
        
        // Log Stock History
        await StockHistory.create({
          raw_material_id: deduction.material._id,
          name: deduction.material.name,
          class_type: deduction.material.class_type,
          category_type: deduction.material.type,
          change_type: "CONSUMED",
          quantity_changed: deduction.requiredQty,
          sub_type: "processed",
          current_quantity_snapshot: deduction.material.quantity,
          reference_text: `Production of ${finishedGood.model} - ${finishedGood.type} (${quantity} units)`,
          changed_by: req.user ? {
            user_id: req.user.id,
            name: req.user.name,
            user_name: req.user.user_name,
            email: req.user.email
          } : undefined,
          date: historyDate,
          production_history_id: productionHistory._id
        });
      }

      // Find or create production record for this finished good
      let production = await ensureSingleProductionPerFinishedGood(finishedGood._id);

      if (!production) {
        // Create new production record for excess production
        production = new Production({
          finished_good: finishedGood._id,
          customer_name: "Excess Production",
          order_quantity: 0,
          quantity: 0,
          production_quantity: 0,
          produced_quantity: quantity,
          status: "COMPLETED",
          created_at: historyDate,
          updated_at: new Date(),
        });
        await production.save();
      } else {
        // Update existing production record
        // Increase produced quantity and decrease production_quantity (pending)
        production.produced_quantity += quantity;
        production.production_quantity = Math.max(0, production.production_quantity - quantity);
        production.updated_at = new Date();
        await production.save();
      }

      // Increase the finished good stock
      const currentUnits = finishedGood.units || 0;
      finishedGood.units = currentUnits + quantity;
      finishedGood.updated_at = new Date();
      await finishedGood.save();
      
      // Log Fg History
      await FgHistory.create({
        finished_good_id: finishedGood._id,
        model: finishedGood.model,
        type: finishedGood.type,
        change_type: "PRODUCTION_ADDITION",
        quantity_changed: quantity,
        current_quantity: finishedGood.units,
        reference_text: `Daily Production Added`,
        changed_by: req.user ? {
          user_id: req.user.id,
          name: req.user.name,
          user_name: req.user.user_name,
          email: req.user.email
        } : undefined,
        date: historyDate
      });
      
      // Finalize Production History with raw materials used
      productionHistory.raw_materials_used = currentRawMaterialsUsed;
      await productionHistory.save();

      results.push({
        finished_good: {
          id: finishedGood._id,
          model: finishedGood.model,
          type: finishedGood.type,
          ratio: finishedGood.ratio,
          power: finishedGood.power,
          previous_units: currentUnits,
          new_units: finishedGood.units,
          added_quantity: quantity
        },
        production: {
          id: production._id,
          pro_id: production.pro_id,
          production_quantity_remaining: production.production_quantity,
          produced_quantity: production.produced_quantity
        }
      });
    }

    // If no items were processed successfully, return error
    if (results.length === 0) {
      return res.status(400).json({
        error: "No finished goods were processed successfully",
        errors,
        results: []
      });
    }

    // Build response message based on success/failure
    let message = `Successfully added production for ${results.length} finished good(s)`;
    if (errors.length > 0) {
      message += `. ${errors.length} item(s) could not be added due to insufficient BOM materials or other errors.`;
    }

    // Determine appropriate status code
    // 207 = Multi-Status (partial success), but many clients don't handle it well
    // So we'll use 201 (Created) but make errors very clear
    const statusCode = errors.length > 0 ? 201 : 201; // Keep 201 but make errors prominent

    logger.info(`Daily production added for ${results.length} items`);
    res.status(statusCode).json({
      message,
      success: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : []
    });
  } catch (err) {
    next(err);
  }
};

// Clean up duplicate production records (admin function)
export const cleanupDuplicateProductions = async (req, res, next) => {
  try {
    // Get all finished goods
    const finishedGoods = await FinishedGoods.find({});
    let cleanedCount = 0;

    for (const fg of finishedGoods) {
      const productions = await Production.find({
        finished_good: fg._id
      });

      if (productions.length > 1) {
        // Merge all production records into the first one
        const mainProduction = productions[0];
        const otherProductions = productions.slice(1);

        // Sum up all quantities
        let totalOrderQuantity = mainProduction.order_quantity || 0;
        let totalQuantity = mainProduction.quantity || 0;
        let totalProductionQuantity = mainProduction.production_quantity || 0;
        let totalProducedQuantity = mainProduction.produced_quantity || 0;

        for (const prod of otherProductions) {
          totalOrderQuantity += prod.order_quantity || 0;
          totalQuantity += prod.quantity || 0;
          totalProductionQuantity += prod.production_quantity || 0;
          totalProducedQuantity += prod.produced_quantity || 0;
        }

        // Update main production record
        mainProduction.order_quantity = totalOrderQuantity;
        mainProduction.quantity = totalQuantity;
        mainProduction.production_quantity = totalProductionQuantity;
        mainProduction.produced_quantity = totalProducedQuantity;
        mainProduction.updated_at = new Date();
        await mainProduction.save();

        // Delete other production records
        await Production.deleteMany({
          _id: { $in: otherProductions.map(p => p._id) }
        });

        cleanedCount += otherProductions.length;
      }
    }

    logger.info(`Duplicate productions cleaned up: ${cleanedCount}`);
    res.status(200).json({
      message: `Cleaned up ${cleanedCount} duplicate production records`,
      cleanedCount
    });
  } catch (err) {
    next(err);
  }
};

// Recalculate production quantities based on remaining sales orders
export const recalculateProductionQuantities = async (req, res) => {
  try {
    const { finished_good_id } = req.body;

    let query = {};
    if (finished_good_id) {
      query.finished_good = finished_good_id;
    }

    const productions = await Production.find(query).populate('finished_good');
    let updatedCount = 0;

    for (const production of productions) {
      // Get all sales orders for this finished good that are not fully invoiced
      const salesOrders = await Sales.find({
        'finished_goods.finished_good': production.finished_good._id,
        status: { $in: ['INPROCESS', 'PROCESSED'] }
      });

      let totalRequiredQuantity = 0;

      for (const salesOrder of salesOrders) {
        const salesItem = salesOrder.finished_goods.find(
          item => item.finished_good.toString() === production.finished_good._id.toString()
        );

        if (salesItem) {
          // Calculate remaining quantity needed (total ordered - already invoiced)
          const remainingQuantity = salesItem.quantity - (salesItem.invoiced_quantity || 0);
          totalRequiredQuantity += Math.max(0, remainingQuantity);
        }
      }

      // Update production quantity
      const oldProductionQuantity = production.production_quantity;
      production.production_quantity = totalRequiredQuantity;
      production.updated_at = new Date();
      await production.save();

      if (oldProductionQuantity !== totalRequiredQuantity) {
        updatedCount++;
        console.log(`Updated production for ${production.finished_good.model}: ${oldProductionQuantity} -> ${totalRequiredQuantity}`);
      }
    }

    res.status(200).json({
      message: `Recalculated production quantities for ${updatedCount} production records`,
      updatedCount,
      totalChecked: productions.length
    });
  } catch (err) {
    console.error("Error in recalculateProductionQuantities:", err);
    res.status(500).json({ error: err.message });
  }
};

// Check raw material availability for a finished good
export const checkRawMaterialAvailability = async (req, res) => {
  try {
    const { model, type, ratio, power } = req.query;

    if (!model || !type || !ratio || !power) {
      return res.status(400).json({
        error: "All parameters (model, type, ratio, power) are required"
      });
    }

    // Find the finished good
    const finishedGood = await FinishedGoods.findOne({
      model,
      type,
      ratio,
      power,
    });

    if (!finishedGood) {
      return res.status(404).json({
        error: "Finished good not found"
      });
    }

    // Check raw material availability
    let maxProducibleQuantity = Infinity;
    const rawMaterialLimits = [];

    for (const rm of finishedGood.raw_materials) {
      const material = await RawMaterials.findById(rm.raw_material_id);
      if (!material || typeof material.quantity !== "object") {
        return res.status(400).json({
          error: `Invalid raw material found: ${material?.name || 'Unknown'}`
        });
      }

      const availableQty = material.quantity.processed || 0;
      const maxFromThisMaterial = Math.floor(availableQty / rm.quantity);

      rawMaterialLimits.push({
        material_id: material._id,
        material_name: material.name || 'Unknown',
        material_type: material.type || 'Unknown',
        available_quantity: availableQty,
        required_per_unit: rm.quantity,
        max_producible: maxFromThisMaterial
      });

      maxProducibleQuantity = Math.min(maxProducibleQuantity, maxFromThisMaterial);
    }

    res.status(200).json({
      finished_good: {
        id: finishedGood._id,
        model: finishedGood.model,
        type: finishedGood.type,
        ratio: finishedGood.ratio,
        power: finishedGood.power
      },
      max_producible_quantity: maxProducibleQuantity,
      raw_material_limits: rawMaterialLimits,
      can_produce: maxProducibleQuantity > 0
    });
  } catch (err) {
    console.error("Error in checkRawMaterialAvailability:", err);
    res.status(500).json({ error: err.message });
  }
};

