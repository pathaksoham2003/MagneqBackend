import Purchase from '../models/Purchase.js';
import { filterFieldsByClass } from '../utils/helper.js';

export const createPurchaseOrder = async (req, res) => {
  try {
    const { vendor_name, purchasing_date, items, status } = req.body;

    if (!vendor_name || !purchasing_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or items' });
    }

    const newOrder = new Purchase({
      vendor_name,
      purchasing_date,
      items,
      status
    });

    const saved = await newOrder.save();

    res.status(201).json({ message: 'Purchase order created', order: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create purchase order', details: err.message });
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const orders = await Purchase.find().populate("items.raw_material_id");

    const filteredOrders = orders.map(order => {
      const filteredItems = order.items.map(item => {
        const type = item.raw_material_id.class_type;
        if (["A", "B", "C"].includes(type)) {
          return {
            ...item.toObject(), 
            raw_material_id: filterFieldsByClass(type, item.raw_material_id.toObject()),
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
    res.status(500).json({ error: "Failed to fetch purchase orders" });
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
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update purchase order" });
  }
};