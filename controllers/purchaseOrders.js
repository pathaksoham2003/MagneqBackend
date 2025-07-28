import {PO_ITEM_STATUS, PO_STATUS} from "../enums/purchase.js";
import Purchase from "../models/Purchase.js";
import RawMaterials from "../models/RawMaterials.js";

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

    const pendingItems = items.map((it) => {
      const item_total_price =
        parseFloat(it.price_per_unit || 0) * parseFloat(it.quantity || 0);
      return {
        ...it,
        item_total_price: item_total_price.toFixed(2),
        recieved_quantity: 0,
        status: PO_ITEM_STATUS.PENDING,
      };
    });

    const total_price = pendingItems.reduce(
      (sum, item) => sum + parseFloat(item.item_total_price || 0),
      0
    );

    const newOrder = new Purchase({
      vendor_name,
      purchasing_date,
      items: pendingItems,
      status: PO_STATUS.PENDING,
      total_price: total_price.toFixed(2),
    });

    const saved = await newOrder.save();
    res.status(201).json({message: "Purchase order created", order: saved});
  } catch (err) {
    res
      .status(500)
      .json({error: "Failed to create purchase order", details: err.message});
  }
};

export const getAllPurchases = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const filter = {  };
    const totalCount = await Purchase.countDocuments(filter);

    const purchases = await Purchase.find(filter)
      .sort({created_at: -1})
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "items.raw_material_id",
        select: "class_type",
      });

    const items = purchases.map((purchase) => {
      const classTotals = {A: 0, B: 0, C: 0};

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
          purchase.status,
        ],
      };
    });

    res.status(200).json({
      header: [
        "Production Id",
        "Vendor Name",
        "Date of purchase",
        "Order Details",
        "Status",
      ],
      item: items,
      page_no: pageNo,
      total_pages: Math.ceil(totalCount / PAGE_SIZE),
      total_items: totalCount,
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

export const getPurchaseOrderItems = async (req, res) => {
  try {
    const {po_number} = req.params;
    const {class_type} = req.query;

    const order = await Purchase.findOne({po_number});
    if (!order) {
      return res.status(404).json({error: "Purchase order not found"});
    }

    const resultItems = [];

    for (const item of order.items) {
      const material = await RawMaterials.findById(item.raw_material_id);
      if (!material) continue;
      if (class_type && material.class_type !== class_type) continue;

      const max_allowed = (item.quantity || 0) - (item.recieved_quantity || 0);

      resultItems.push({
        item_id: material._id,
        _id:item._id,
        name: material.name || material.model || "Unnamed",
        max_allowed: max_allowed < 0 ? 0 : max_allowed,
      });
    }

    res.status(200).json({
      po_number,
      total_items: resultItems.length,
      items: resultItems,
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

export const addStockToPurchaseOrder = async (req, res) => {
  try {
    const {po_id, items} = req.body;

    if (!po_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({error: "Missing po_id or items array"});
    }

    const purchaseOrder = await Purchase.findById(po_id).populate({
      path: "items.raw_material_id", 
      select: "_id class_type", 
    });
    if (!purchaseOrder) {
      return res.status(404).json({error: "Purchase order not found"});
    }

    let allRecieved = false;
    for (const item of items) {
      for (const poItem of purchaseOrder.items) {
        if (poItem._id.equals(item.item_id)) {
          allRecieved = true;
          const incPath =
            poItem.raw_material_id.class_type === "B" ? "quantity.unprocessed" : "quantity.processed";
          const oldQuantity = poItem.recieved_quantity;
          const toAddQuantity = item.recieved_quantity;
          const newTotal = oldQuantity + toAddQuantity;
          poItem.recieved_quantity = newTotal;

          if (newTotal >= poItem.quantity) {
            poItem.status = PO_ITEM_STATUS.RECIEVED;
          }
          allRecieved = allRecieved && newTotal >= poItem.quantity;
          await RawMaterials.findByIdAndUpdate(
            poItem.raw_material_id,
            {
              $inc: {[incPath]: toAddQuantity},
              $set: {updated_at: new Date()},
            },
            {new: true}
          );
        }
      }
    }
    if (allRecieved) {
      purchaseOrder.status = PO_STATUS.COMPLETE;
    }
    await purchaseOrder.save();

    res.status(200).json({
      message: "Stock updated successfully and raw materials updated",
      status: purchaseOrder.status,
      updated_items: items.length,
    });
  } catch (err) {
    res.status(500).json({error: err.message});
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
    res.status(500).json({error: "Failed to update purchase order"});
  }
};

export const getPurchaseDetails = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.po_id).populate({
      path: "items.raw_material_id",
      model: RawMaterials,
      select: "name type class_type",
    });
    // console.log(purchase)
    if (!purchase) {
      return res.status(404).json({message: "Purchase Not Found"});
    }

    const simplifiedItems = purchase.items.map((item) => ({
      class: item.raw_material_id?.class_type,
      name: item.raw_material_id?.name,
      type: item.raw_material_id?.type,
      price_per_unit: item.price_per_unit,
      quantity: item.quantity,
    }));

    const response = {
      _id: purchase._id,
      vendor_name: purchase.vendor_name,
      purchasing_date: purchase.purchasing_date,
      status: purchase.status,
      po_number: purchase.po_number,
      total_price: purchase.total_price,
      created_at: purchase.created_at,
      updated_at: purchase.updated_at,
      items: simplifiedItems,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching purchase:", err);
    return res.status(500).json({error: err.message});
  }
};
