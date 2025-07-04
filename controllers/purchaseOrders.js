import { PO_ITEM_STATUS, PO_STATUS } from "../enums/purchase.js";
import Purchase from "../models/Purchase.js";
import RawMaterials from "../models/RawMaterials.js";
import { filterFieldsByClass } from "../utils/helper.js";

export const createPurchaseOrder = async (req, res) => {
  try {
    const { vendor_name, purchasing_date, items } = req.body;

    if (!vendor_name || !purchasing_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields or items" });
    }

    const pendingItems = items.map((it) => {
      const item_total_price = parseFloat(it.price_per_unit || 0) * parseFloat(it.quantity || 0);
      return {
        ...it,
        item_total_price: item_total_price.toFixed(2),
        recieved_quantity: 0,
        status: PO_ITEM_STATUS.PENDING,
      };
    });

    const total_price = pendingItems.reduce((sum, item) => sum + parseFloat(item.item_total_price || 0), 0);

    const newOrder = new Purchase({
      vendor_name,
      purchasing_date,
      items: pendingItems,
      status: PO_STATUS.PENDING,
      total_price: total_price.toFixed(2),
    });

    const saved = await newOrder.save();
    res.status(201).json({ message: "Purchase order created", order: saved });
  } catch (err) {
    res.status(500).json({ error: "Failed to create purchase order", details: err.message });
  }
};

export const getAllPurchases = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;

    const totalCount = await Purchase.countDocuments();

    const purchases = await Purchase.find()
      .sort({ created_at: -1 })
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "items.raw_material_id",
        select: "class_type",
      });

    const items = purchases.map(purchase => {
      const classTotals = { A: 0, B: 0, C: 0 };

      for (const item of purchase.items) {
        const mat = item.raw_material_id;
        const classType = mat?.class_type;

        if (classType && classTotals.hasOwnProperty(classType)) {
          classTotals[classType] += item.quantity;
        }
      }

      const orderDetails = Object.entries(classTotals)
        .filter(([_, qty]) => qty > 0)
        .map(([cls, qty]) => `${cls}/${qty}`);

      return {
        id: purchase._id,
        data: [
          `PRO-${purchase.po_number}`,
          purchase.vendor_name,
          purchase.purchasing_date,
          orderDetails,
          purchase.status
        ],
      };
    });

    res.status(200).json({
      header: [
        "Production Id",
        "Vendor Name",
        "Date of purchase",
        "Order Details",
        "Status"
      ],
      item: items,
      page_no: pageNo,
      total_pages: Math.ceil(totalCount / PAGE_SIZE),
      total_items: totalCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getPurchaseOrderItems = async (req, res) => {
  try {
    const { po_number } = req.params;
    const { class_type } = req.query;

    const order = await Purchase.findOne({ po_number });
    if (!order) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const resultItems = [];

    for (const item of order.items) {
      const material = await RawMaterials.findById(item.raw_material_id);
      if (!material) continue;
      if (class_type && material.class_type !== class_type) continue;

      const max_allowed = (item.quantity || 0) - (item.recieved_quantity || 0);

      resultItems.push({
        item_id: material._id,
        name: material.product || material.model || "Unnamed",
        max_allowed: max_allowed < 0 ? 0 : max_allowed,
      });
    }

    res.status(200).json({
      po_number,
      total_items: resultItems.length,
      items: resultItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addStockToPurchaseOrder = async (req, res) => {
  try {
    const { po_id, items } = req.body;

    if (!po_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing po_id or items array" });
    }

    const purchaseOrder = await Purchase.findById(po_id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const itemUpdates = new Map();
    for (const item of items) {
      if (!item.item_id || typeof item.recieved_quantity !== "number") {
        return res.status(400).json({ error: "Invalid item format" });
      }
      itemUpdates.set(item.item_id, item.recieved_quantity);
    }

    let allComplete = true;

    for (const poItem of purchaseOrder.items) {
      const updateQty = itemUpdates.get(poItem._id.toString());

      if (updateQty !== undefined) {
        const previouslyReceived = poItem.recieved_quantity || 0;
        const newTotal = previouslyReceived + updateQty;
        const finalReceivedQty = Math.min(newTotal, poItem.quantity);
        const addedQtyToStock = finalReceivedQty - previouslyReceived;

        poItem.recieved_quantity = finalReceivedQty;
        poItem.status = finalReceivedQty >= poItem.quantity ? "COMPLETED" : "PENDING";

        if (addedQtyToStock > 0) {
          await RawMaterials.findByIdAndUpdate(
            poItem.raw_material_id,
            {
              $inc: { quantity: addedQtyToStock },
              $set: { updated_at: new Date() },
            },
            { new: true }
          );
        }
      }

      if ((poItem.recieved_quantity || 0) < poItem.quantity) {
        allComplete = false;
      }
    }

    if (allComplete) {
      purchaseOrder.status = "COMPLETE";
    }

    await purchaseOrder.save();

    res.status(200).json({
      message: "Stock updated successfully and raw materials updated",
      status: purchaseOrder.status,
      updated_items: items.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = await Purchase.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("items.raw_material_id");

    if (!updatedOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: "Failed to update purchase order" });
  }
};
