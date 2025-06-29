import {PO_ITEM_STATUS, PO_STATUS} from "../enums/purchase.js";
import Purchase from "../models/Purchase.js";
import RawMaterials from "../models/RawMaterials.js";
import {filterFieldsByClass} from "../utils/helper.js";

export const createPurchaseOrder = async (req, res) => {
  try {
    const {vendor_name, purchasing_date, items} = req.body;

    if (
      !vendor_name ||
      !purchasing_date ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({error: "Missing required fields or items"});
    }
    const pendingItems = items.map((it) => ({
      ...it,
      recieved_quantity: 0,
      status: PO_ITEM_STATUS.PENDING,
    }));

    const newOrder = new Purchase({
      vendor_name,
      purchasing_date,
      items: pendingItems,
      status: PO_STATUS.PENDING,
    });

    const saved = await newOrder.save();

    res.status(201).json({message: "Purchase order created", order: saved});
  } catch (err) {
    res
      .status(500)
      .json({error: "Failed to create purchase order", details: err.message});
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const orders = await Purchase.find().populate("items.raw_material_id");

    const filteredOrders = orders.map((order) => {
      const filteredItems = order.items.map((item) => {
        const type = item.raw_material_id.class_type;
        if (["A", "B", "C"].includes(type)) {
          return {
            ...item.toObject(),
            raw_material_id: filterFieldsByClass(
              type,
              item.raw_material_id.toObject()
            ),
          };
        }
        return item;
      });

      return {
        ...order.toObject(),
        items: filteredItems,
      };
    });

    res.json(filteredOrders);
  } catch (err) {
    res.status(500).json({error: "Failed to fetch purchase orders"});
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

export const updatePurchaseOrder = async (req, res) => {
  try {
    const {id} = req.params;
    const updatedOrder = await Purchase.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("items.raw_material_id");

    if (!updatedOrder) {
      return res.status(404).json({error: "Purchase order not found"});
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({error: "Failed to update purchase order"});
  }
};
