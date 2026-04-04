import FgHistory from "../models/FgHistory.js";
import ProductionHistory from "../models/ProductionHistory.js";
import StockHistory from "../models/StockHistory.js";
import logger from "../utils/logger.js";

// Formatter for returning user info safely
const formatChangedBy = (changedBy) => {
  if (!changedBy) return null;
  return {
    id: changedBy.user_id,
    name: changedBy.name,
    user_name: changedBy.user_name,
    email: changedBy.email
  };
};

export const getFgHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { model: searchRegex },
          { type: searchRegex },
          { reference_text: searchRegex }
        ]
      };
      // If it looks like a MongoDB ID, add to query
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: search });
      }
    }

    const total_items = await FgHistory.countDocuments(query);
    const histories = await FgHistory.find(query)
      .populate("finished_good_id", "model type ratio power units")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedItems = histories.map(h => ({
      id: h._id,
      data: [
        h._id.toString().slice(-6),
        new Date(h.date).toLocaleDateString("en-GB") + " " + new Date(h.date).toLocaleTimeString("en-GB"),
        `${h.model || h.finished_good_id?.model} - ${h.type || h.finished_good_id?.type}`,
        h.change_type,
        h.quantity_changed,
        h.current_quantity,
        h.reference_text || "-",
        h.changed_by?.name || "System"
      ]
    }));

    res.status(200).json({
      header: ["Hist-ID", "Date", "Finished Good", "Change Type", "Quantity Changed", "Current Quantity", "Reference", "Changed By"],
      item: formattedItems,
      page_no: page,
      total_pages: Math.ceil(total_items / limit),
      total_items
    });
  } catch (error) {
    next(error);
  }
};

export const getProductionHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { model: searchRegex },
          { type: searchRegex },
          { reference_text: searchRegex }
        ]
      };
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: search });
      }
    }

    const total_items = await ProductionHistory.countDocuments(query);
    const histories = await ProductionHistory.find(query)
      .populate("finished_good_id", "model type ratio power")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedItems = histories.map(h => ({
      id: h._id,
      data: [
        h._id.toString().slice(-6),
        new Date(h.date).toLocaleDateString("en-GB") + " " + new Date(h.date).toLocaleTimeString("en-GB"),
        `${h.model || h.finished_good_id?.model} - ${h.type || h.finished_good_id?.type}`,
        h.quantity_produced,
        (h.raw_materials_used || []).map(rm => `${rm.name} (${rm.class_type}): ${rm.quantity_consumed}`),
        h.reference_text || "-",
        h.changed_by?.name || "System"
      ]
    }));

    res.status(200).json({
      header: ["Hist-ID", "Date", "Finished Good", "Qty Produced", "Materials Used", "Reference / Desc", "Changed By"],
      item: formattedItems,
      page_no: page,
      total_pages: Math.ceil(total_items / limit),
      total_items
    });
  } catch (error) {
    next(error);
  }
};

export const getRawMaterialHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const class_type = req.query.class_type;
    const search = req.query.search;
    let query = {};
    if (class_type) {
      query.class_type = class_type;
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { reference_text: searchRegex }
      ];
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: search });
        query.$or.push({ purchase_id: search });
        query.$or.push({ production_history_id: search });
      }
    }

    const total_items = await StockHistory.countDocuments(query);
    const histories = await StockHistory.find(query)
      .populate("raw_material_id", "name type class_type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedItems = histories.map(h => {
      let currentQtyStr = "";
      if (h.current_quantity_snapshot) {
        if (typeof h.current_quantity_snapshot === 'object') {
           currentQtyStr = Object.entries(h.current_quantity_snapshot).map(([k,v]) => `${k}:${v}`).join(", ");
        } else {
           currentQtyStr = h.current_quantity_snapshot.toString();
        }
      }

      let refId = "-";
      if (h.purchase_id) {
        refId = `Pur: ${h.purchase_id.toString().slice(-6)}`;
      } else if (h.production_history_id) {
        refId = `Pro: ${h.production_history_id.toString().slice(-6)}`;
      }

      return {
        id: h._id,
        data: [
          h._id.toString().slice(-6),
          new Date(h.date).toLocaleDateString("en-GB") + " " + new Date(h.date).toLocaleTimeString("en-GB"),
          `${h.name || h.raw_material_id?.name} (${h.class_type})`,
          h.change_type,
          `${h.sub_type ? h.sub_type + ': ' : ''}${h.quantity_changed}`,
          currentQtyStr,
          h.reference_text || "-",
          refId,
          h.changed_by?.name || "System"
        ],
        snapshot: h.current_quantity_snapshot
      };
    });

    res.status(200).json({
      header: ["Hist-ID", "Date", "Raw Material", "Change Type", "Qty Changed", "Snapshot", "Reference", "Ref ID", "Changed By"],
      item: formattedItems,
      page_no: page,
      total_pages: Math.ceil(total_items / limit),
      total_items
    });
  } catch (error) {
    next(error);
  }
};
