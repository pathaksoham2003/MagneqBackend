import DeliveryDetails from "../models/DeliveryDetails.js";
import Invoice from "../models/Invoice.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

const getFgModelNumber = (fg) => {
  if (!fg) return "";
  return `${fg.model || ""}-${fg.type || ""}-${fg.ratio || ""}-${fg.power || ""}`;
};

export const createDelivery = async (req, res, next) => {
  try {
    const { invoices, from, to, description } = req.body;

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ message: "At least one invoice ID is required" });
    }

    // 1. Fetch invoices
    const invoiceDocs = await Invoice.find({ _id: { $in: invoices } });

    if (!invoiceDocs || invoiceDocs.length === 0) {
      return res.status(404).json({ message: "Invoices not found" });
    }

    // 2. Update invoice statuses
    await Invoice.updateMany(
      { _id: { $in: invoices } },
      { $set: { status: "DISPATCHED" } }
    );

    // 3. Create delivery record
    const delivery = await DeliveryDetails.create({
      invoices,
      from,
      to,
      description,
      dispatched_by: req.user?._id,
    });

    logger.info(`Delivery created: ${delivery._id} by ${req.user.user_name} for ${invoices.length} invoices`);
    return res.status(201).json({
      message: "Delivery created successfully",
      delivery,
    });
  } catch (err) {
    next(err);
  }
};

// UPDATE Delivery (LR number, transport details, description)
export const updateDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lr_number, transport_details, description } = req.body;

    const delivery = await DeliveryDetails.findByIdAndUpdate(
      id,
      { $set: { lr_number, transport_details, description } },
      { new: true }
    );

    if (!delivery) return res.status(404).json({ message: "Delivery not found" });

    logger.info(`Delivery updated: ${id} by ${req.user.user_name}`);
    return res.status(200).json(delivery);
  } catch (err) {
    next(err);
  }
};

// GET All Deliveries (same format as invoices/sales)
export const getAllDeliveries = async (req, res, next) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchDeliveryId = req.query.search ? req.query.search : null;

    const query = searchDeliveryId ? { _id: new mongoose.Types.ObjectId(searchDeliveryId) } : {};

    const totalCount = await DeliveryDetails.countDocuments(query);

    const deliveries = await DeliveryDetails.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "invoices",
        populate: {
          path: "items.finished_good",
          select: "model type ratio power",
        },
      })
      .populate({
        path: "dispatched_by",
        select: "name user_name role",
      });

    const items = deliveries.map((delivery) => {
      const deliveryDetails = delivery.invoices.map((inv) => {
        const invDetails = inv.items.map(
          (it) => `${getFgModelNumber(it.finished_good)}/${it.invoiced_quantity}`
        );
        return `INV-${inv.invoice_number}: ${invDetails.join(", ")}`;
      });

      return {
        id: delivery._id,
        data: [
          `DEL-${delivery._id.toString().slice(-6)}`, // readable short id
          delivery.dispatched_at,
          delivery.from?.state + " → " + delivery.to?.state,
          deliveryDetails,
          delivery.lr_number || "Pending",
        ],
      };
    });

    res.status(200).json({
      header: [
        "Delivery Id",
        "Dispatched At",
        "Route",
        "Invoice Details",
        "LR Number",
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

export const getDeliveryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const delivery = await DeliveryDetails.findById(id)
      .populate("invoices", "invoice_number") // ✅ only pick invoice_number
      .select(
        "invoices from to description lr_number transport_details dispatched_by dispatched_at createdAt updatedAt"
      );

    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    return res.status(200).json(delivery);
  } catch (err) {
    next(err);
  }
};