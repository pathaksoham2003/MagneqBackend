import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Production from "../models/Production.js";
import {getFgModelNumber, getModelNumber} from "../utils/helper.js";
import mongoose from 'mongoose'

export const createSale = async (req, res) => {
  try {
    const saleData = {
      ...req.body,
      status: "UN_APPROVED",
      created_by: req.user.id,
    };
    let totalAmount = 0;
    const updatedFinishedGoods = [];

    for (const item of saleData.finished_goods) {
      const {model, type, ratio, power, rate_per_unit, quantity} = item;

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

      const rate = parseFloat(rate_per_unit || 0);
      const qty = parseFloat(quantity || 0);
      const itemTotal = rate * qty;
      totalAmount += itemTotal;

      updatedFinishedGoods.push({
        finished_good: finishedGood._id,
        rate_per_unit: rate.toFixed(2),
        quantity: qty,
        item_total_price: itemTotal.toFixed(2),
      });
    }

    saleData.finished_goods = updatedFinishedGoods;
    saleData.total_amount = totalAmount.toFixed(2);
    const sale = new Sales(saleData);
    const savedSale = await sale.save();

    res.status(201).json({sale: savedSale});
  } catch (err) {
    console.error("Error in createSale:", err);
    res.status(500).json({error: err.message});
  }
};

export const approveSale = async (req, res) => {
  try {
    const {id} = req.params;
    const {finished_goods} = req.body;
    const sale = await Sales.findById(id);

    if (!sale) {
      return res.status(404).json({error: "Sale not found"});
    }

    if (sale.status !== "UN_APPROVED") {
      return res
        .status(400)
        .json({error: "Sale is already approved or processed"});
    }

    // If rates are provided, update them before approval
    if (Array.isArray(finished_goods) && finished_goods.length) {
      let totalAmount = 0;
      // Update only the rates for matching fg_id
      sale.finished_goods = sale.finished_goods.map((origItem) => {
        const updateItem = finished_goods.find(fg => {
          // fg_id can be string or ObjectId, so compare as string
          return fg.fg_id?.toString() === origItem.finished_good.toString();
        });
        if (updateItem) {
          const rate = parseFloat(updateItem.rate_per_unit || 0);
          const quantity = parseFloat(updateItem.quantity || origItem.quantity || 0);
          const itemTotal = rate * quantity;
          totalAmount += itemTotal;
          return {
            ...origItem.toObject(),
            rate_per_unit: rate,
            item_total_price: itemTotal.toFixed(2),
          };
        } else {
          totalAmount += parseFloat(origItem.item_total_price || 0);
          return origItem;
        }
      });
      sale.total_amount = totalAmount.toFixed(2);
    }

    sale.status = "INPROCESS";
    sale.updated_at = new Date();
    await sale.save();

    const productionRecords = [];

    for (const item of sale.finished_goods) {
      const fg = await FinishedGoods.findById(item.finished_good);
      if (!fg) continue;

      const production = new Production({
        order_id: sale.order_id,
        finished_good: fg._id,
        customer_name: sale.customer_name,
        quantity: item.quantity,
        status: "UN_PROCESSED",
        created_at: new Date(),
        updated_at: new Date(),
      });

      await production.save();
      productionRecords.push(production);
    }

    res
      .status(200)
      .json({message: "Sale approved", sale, productions: productionRecords});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

// Add a rejectSale endpoint
export const rejectSale = async (req, res) => {
  try {
    const {id} = req.params;
    const sale = await Sales.findById(id);
    if (!sale) {
      return res.status(404).json({error: "Sale not found"});
    }
    if (sale.status !== "UN_APPROVED") {
      return res.status(400).json({error: "Sale is already processed"});
    }
    sale.status = "CANCELLED";
    sale.updated_at = new Date();
    await sale.save();
    res.status(200).json({message: "Sale rejected", sale});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

export const getAllSales = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchOrderId = req.query.search ? parseInt(req.query.search) : null;

    const query = searchOrderId ? {order_id: searchOrderId} : {};

    if (req.user?.role === "CUSTOMER") {
      query.created_by = req.user.id;
    }

    const totalCount = await Sales.countDocuments(query);

    const sales = await Sales.find(query)
      .sort({createdAt: -1})
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "finished_goods.finished_good",
        select: "model type ratio other_specification",
      })
      .populate({
        path: "created_by",
        select: "name user_name role",
      });

    const items = sales.map((sale) => {
      const orderDetails = sale.finished_goods.map((fg) => {
        const fgData = fg.finished_good;
        return `${getFgModelNumber(fgData)}/${fg.quantity}`;
      });

      return {
        id: sale._id,
        data: [
          `SO-${sale.order_id}`,
          sale.createdAt,
          sale.customer_name,
          orderDetails,
          sale.status,
        ],
      };
    });

    res.status(200).json({
      header: [
        "Order Id",
        "Date of Creation",
        "Customer Name",
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

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate("finished_goods.finished_good")
      .populate("created_by");

    const header = [
      "Quantity",
      "Finished Good",
      "Rate per Unit",
      "Item Total Price",
      "Status",
    ];

    const headerLevelData = {
      "Order Id": sale.order_id,
      "Date of Creation": sale.createdAt,
      "Customer Name": sale.customer_name,
      "Order Details": sale.finished_goods.map((item) => {
        return `${getFgModelNumber(item.finished_good)}/${item.quantity}`;
      }),
      Status: sale.status,
    };

    const finishedGoods = sale.finished_goods.map((item) => {
      return {
        fg_id:item.finished_good._id,
        quantity: item.quantity,
        finished_good: getFgModelNumber(item.finished_good),
        rate_per_unit: Number(item.rate_per_unit),
        item_total_price: Number(item.item_total_price),
        status: item.status,
      };
    });

    if (!sale) return res.status(404).json({message: "Sale not found"});
    res
      .status(200)
      .json({headerLevelData, itemLevelData: {header, items: finishedGoods}});
  } catch (err) {
    console.log(err)
    res.status(500).json({error: err.message});
  }
};

export const updateSale = async (req, res) => {
  try {
    let updateData = {...req.body};

    if (updateData.finished_goods) {
      let totalAmount = 0;
      updateData.finished_goods = updateData.finished_goods.map((item) => {
        const rate = parseFloat(item.rate_per_unit || 0);
        const quantity = parseFloat(item.quantity || 0);
        const itemTotal = rate * quantity;

        totalAmount += itemTotal;

        return {
          ...item,
          item_total_price: itemTotal.toFixed(2),
        };
      });
      updateData.total_amount = totalAmount.toFixed(2);
    }

    const updated = await Sales.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    })
      .populate("finished_goods.finished_good")
      .populate("created_by");

    if (!updated) return res.status(404).json({message: "Sale not found"});
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
};

export const deleteSale = async (req, res) => {
  try {
    const deleted = await Sales.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({message: "Sale not found"});
    res.status(200).json({message: "Sale deleted"});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
