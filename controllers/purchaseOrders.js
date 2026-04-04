import {PO_ITEM_STATUS, PO_STATUS} from "../enums/purchase.js";
import Purchase from "../models/Purchase.js";
import RawMaterials from "../models/RawMaterials.js";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import Vendors from "../models/Vendors.js";
import mongoose from "mongoose";
import StockHistory from "../models/StockHistory.js";
import logger from "../utils/logger.js";

export const createPurchaseOrder = async (req, res, next) => {
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
    logger.info(`Purchase order created: PRO-${saved.po_number} from vendor ${vendor_name}`);
    res.status(201).json({message: "Purchase order created", order: saved});
  } catch (err) {
    next(err);
  }
};

export const getAllPurchases = async (req, res, next) => {
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
          new Date(purchase.purchasing_date).toLocaleDateString("en-GB"),
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
    next(err);
  }
};

export const getPendingPurchases = async (req, res, next) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const filter = { status: { $ne: "COMPLETE" } };
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
    next(err);
  }
};

export const getPurchaseOrderItems = async (req, res, next) => {
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
        class_type: class_type,
      });
    }

    res.status(200).json({
      po_number,
      total_items: resultItems.length,
      items: resultItems,
    });
  } catch (err) {
    next(err);
  }
};

export const addStockToPurchaseOrder = async (req, res, next) => {
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

    // Update received quantities for the items being added
    for (const item of items) {
      for (const poItem of purchaseOrder.items) {
        if (poItem._id.equals(item.item_id)) {
          const incPath =
            poItem.raw_material_id.class_type === "B" ? "quantity.unprocessed" : "quantity.processed";
          const oldQuantity = poItem.recieved_quantity;
          const toAddQuantity = item.recieved_quantity;
          const newTotal = oldQuantity + toAddQuantity;
          poItem.recieved_quantity = newTotal;

          if (newTotal >= poItem.quantity) {
            poItem.status = PO_ITEM_STATUS.RECIEVED;
          }
          const updatedRawMaterial = await RawMaterials.findByIdAndUpdate(
            poItem.raw_material_id,
            {
              $inc: {[incPath]: toAddQuantity},
              $set: {updated_at: new Date()},
            },
            {new: true}
          );
          
          if (updatedRawMaterial) {
            await StockHistory.create({
              raw_material_id: updatedRawMaterial._id,
              name: updatedRawMaterial.name,
              class_type: updatedRawMaterial.class_type,
              category_type: updatedRawMaterial.type,
              change_type: "ADD_STOCK",
              quantity_changed: toAddQuantity,
              sub_type: poItem.raw_material_id.class_type === "B" ? "unprocessed" : "processed",
              current_quantity_snapshot: updatedRawMaterial.quantity,
              reference_text: `PO-${purchaseOrder.po_number}`,
              purchase_id: purchaseOrder._id,
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

    // Check if all items in the purchase order are fully received
    const allRecieved = purchaseOrder.items.every(item => 
      item.recieved_quantity >= item.quantity
    );
    
    if (allRecieved) {
      purchaseOrder.status = PO_STATUS.COMPLETE;
    }
    await purchaseOrder.save();

    logger.info(`Stock added to PO-${purchaseOrder.po_number}. Status: ${purchaseOrder.status}`);
    res.status(200).json({
      message: "Stock updated successfully and raw materials updated",
      status: purchaseOrder.status,
      updated_items: items.length,
    });
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const {id} = req.params;
    const updatedOrder = await Purchase.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("items.raw_material_id");

    if (!updatedOrder) {
      return res.status(404).json({error: "Purchase order not found"});
    }

    logger.info(`Purchase order updated: PRO-${updatedOrder.po_number}`);
    res.json(updatedOrder);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseDetails = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.po_id).populate({
      path: "items.raw_material_id",
      model: RawMaterials,
      select: "name type class_type",
    });
    if (!purchase) {
      return res.status(404).json({message: "Purchase Not Found"});
    }

    const simplifiedItems = purchase.items.map((item) => ({
      class: item.raw_material_id?.class_type,
      name: item.raw_material_id?.name,
      type: item.raw_material_id?.type,
      price_per_unit: item.price_per_unit,
      quantity: item.quantity,
      recieved_quantity: item.recieved_quantity,
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
    next(err);
  }
};

export const getPurchaseStats = async (req, res, next) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);

    const [
      currentPurchaseAgg,
      prevPurchaseAgg,
      pendingOrdersCount,
      prevPendingOrdersCount,
      currentPayableAgg,
      prevPayableAgg
    ] = await Promise.all([

      // Current month purchase total - sum of all received quantities
      Purchase.aggregate([
        { $match: { created_at: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
        { $unwind: "$items" },
        { $match: { "items.recieved_quantity": { $gt: 0 } } },
        { 
          $addFields: {
            receivedItemPrice: {
              $multiply: [
                { $toDouble: "$items.price_per_unit" },
                { $toDouble: "$items.recieved_quantity" }
              ]
            }
          }
        },
        { $group: { _id: null, total: { $sum: "$receivedItemPrice" } } },
      ]),

      // Previous month purchase total - sum of all received quantities
      Purchase.aggregate([
        { $match: { created_at: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $unwind: "$items" },
        { $match: { "items.recieved_quantity": { $gt: 0 } } },
        { 
          $addFields: {
            receivedItemPrice: {
              $multiply: [
                { $toDouble: "$items.price_per_unit" },
                { $toDouble: "$items.recieved_quantity" }
              ]
            }
          }
        },
        { $group: { _id: null, total: { $sum: "$receivedItemPrice" } } },
      ]),

      // Current month pending orders (not complete)
      Purchase.countDocuments({
        created_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
        status: { $ne: PO_STATUS.COMPLETE }
      }),

      // Previous month pending orders (not complete)
      Purchase.countDocuments({
        created_at: { $gte: prevMonthStart, $lte: prevMonthEnd },
        status: { $ne: PO_STATUS.COMPLETE }
      }),

      // Current month remaining payable - sum of remaining amounts for all orders
      Purchase.aggregate([
        { $match: { created_at: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
        { $unwind: "$items" },
        { 
          $addFields: {
            remainingQuantity: {
              $subtract: [
                { $toDouble: "$items.quantity" },
                { $toDouble: "$items.recieved_quantity" }
              ]
            }
          }
        },
        { $match: { remainingQuantity: { $gt: 0 } } },
        { 
          $addFields: {
            remainingItemPrice: {
              $multiply: [
                { $toDouble: "$items.price_per_unit" },
                "$remainingQuantity"
              ]
            }
          }
        },
        { $group: { _id: null, total: { $sum: "$remainingItemPrice" } } },
      ]),

      // Previous month remaining payable
      Purchase.aggregate([
        { $match: { created_at: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $unwind: "$items" },
        { 
          $addFields: {
            remainingQuantity: {
              $subtract: [
                { $toDouble: "$items.quantity" },
                { $toDouble: "$items.recieved_quantity" }
              ]
            }
          }
        },
        { $match: { remainingQuantity: { $gt: 0 } } },
        { 
          $addFields: {
            remainingItemPrice: {
              $multiply: [
                { $toDouble: "$items.price_per_unit" },
                "$remainingQuantity"
              ]
            }
          }
        },
        { $group: { _id: null, total: { $sum: "$remainingItemPrice" } } },
      ]),
    ]);

    const currentPurchase = parseFloat(currentPurchaseAgg[0]?.total || 0);
    const prevPurchase = parseFloat(prevPurchaseAgg[0]?.total || 0);

    const currentPendingOrders = pendingOrdersCount;
    const prevPendingOrders = prevPendingOrdersCount;

    const currentPayable = parseFloat(currentPayableAgg[0]?.total || 0);
    const prevPayable = parseFloat(prevPayableAgg[0]?.total || 0);

    const calcPercentage = (current, previous) => {
      if (previous === 0 && current === 0) return "0%";
      if (previous === 0) return "+∞%";
      const change = ((current - previous) / previous) * 100;
      const formatted = Math.abs(change).toFixed(2) + "%";
      return change > 0 ? `+${formatted}` : change < 0 ? `-${formatted}` : "0%";
    };

    res.status(200).json({
      total_purchases: currentPurchase.toFixed(2),
      total_purchases_change: calcPercentage(currentPurchase, prevPurchase),

      pending_orders: currentPendingOrders,
      pending_orders_change: calcPercentage(currentPendingOrders, prevPendingOrders),

      total_payable_amount: currentPayable.toFixed(2),
      total_payable_amount_change: calcPercentage(currentPayable, prevPayable),
    });
  } catch (err) {
    next(err);
  }
};


export const getAllVendors = async (req,res, next) => {
  try {
      const {page, limit = 10, search = ""} = req.query;
      const pageNo = parseInt(page);
      const pageSize = 10;

      const searchRegex = new RegExp(search, "i");
      const filter = search ? {name: searchRegex} : {};

      const totalItems = await Vendors.countDocuments(filter);

      const vendors = await Vendors.find(filter)
        .skip((pageNo - 1) * pageSize)
        .limit(pageSize);

      const formatted = vendors.map((vendor) => ({
        id: vendor._id,
        data: [vendor.name || "", vendor.phone || ""],
      }));
      res.status(200).json({
        header: ["Vendor Name", "Phone Number"],
        item: formatted,
        page_no: pageNo,
        total_pages: Math.ceil(totalItems / pageSize),
        total_items: totalItems,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllVendorPurchases = async (req, res, next) => {
  try {
    const { id, page, limit = 10 } = req.query;

    const pageNo = parseInt(page) || 1;
    const PAGE_SIZE = parseInt(limit) || 10;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const vendor = await Vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const filter = { vendor_name: vendor.name };
    const totalCount = await Purchase.countDocuments(filter);

    const purchases = await Purchase.find(filter)
      .sort({ created_at: -1 })
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "items.raw_material_id",
        select: "class_type",
      });

    const purchaseItems = purchases.map((purchase) => {
      const classTotals = { A: 0, B: 0, C: 0 };

      for (const item of purchase.items) {
        const classType = item.raw_material_id?.class_type;
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
      item: purchaseItems,
      page_no: pageNo,
      total_pages: Math.ceil(totalCount / PAGE_SIZE),
      total_items: totalCount,
    });
  } catch (err) {
    next(err);
  }
};