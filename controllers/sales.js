import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Production from "../models/Production.js";
import {getFgModelNumber, getModelNumber} from "../utils/helper.js";
import mongoose from 'mongoose'
import { subMonths, startOfMonth, endOfMonth } from "date-fns";

export const getTopStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);

    const [
      currentSalesAgg,
      prevSalesAgg,
      currentOutstandingAgg,
      prevOutstandingAgg,
      currentOutstandingCountAgg,
      prevOutstandingCountAgg,
    ] = await Promise.all([
      // Total Sales (current & previous month)
      Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
            status: { $in: ["PROCESSED", "DISPATCHED", "DELIVERED", "INPROCESS"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
            status: { $in: ["PROCESSED", "DISPATCHED", "DELIVERED", "INPROCESS"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),

      // Outstanding Amount (current & previous month)
      Sales.aggregate([
        {
          $project: {
            createdAt: 1,
            outstanding: { $subtract: ["$total_amount", "$recieved_amount"] },
          },
        },
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
            outstanding: { $gt: 0 },
          },
        },
        { $group: { _id: null, total: { $sum: "$outstanding" } } },
      ]),
      Sales.aggregate([
        {
          $project: {
            createdAt: 1,
            outstanding: { $subtract: ["$total_amount", "$recieved_amount"] },
          },
        },
        {
          $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
            outstanding: { $gt: 0 },
          },
        },
        { $group: { _id: null, total: { $sum: "$outstanding" } } },
      ]),

      // Due Payment Count (current & previous month)
      Sales.aggregate([
        {
          $project: {
            createdAt: 1,
            outstanding: { $subtract: ["$total_amount", "$recieved_amount"] },
          },
        },
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
            outstanding: { $ne: 0 },
          },
        },
        { $count: "total" },
      ]),
      Sales.aggregate([
        {
          $project: {
            createdAt: 1,
            outstanding: { $subtract: ["$total_amount", "$recieved_amount"] },
          },
        },
        {
          $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
            outstanding: { $ne: 0 },
          },
        },
        { $count: "total" },
      ]),
    ]);

    // Safely extract values
    const currentSales = parseFloat(currentSalesAgg[0]?.total || 0);
    const prevSales = parseFloat(prevSalesAgg[0]?.total || 0);

    const currentOutstanding = parseFloat(currentOutstandingAgg[0]?.total || 0);
    const prevOutstanding = parseFloat(prevOutstandingAgg[0]?.total || 0);

    const currentDueCount = currentOutstandingCountAgg[0]?.total || 0;
    const prevDueCount = prevOutstandingCountAgg[0]?.total || 0;

    const calcPercentage = (current, previous) => {
      if (previous === 0 && current === 0) return "0%";
      if (previous === 0) return "+∞%";
      const change = ((current - previous) / previous) * 100;
      const formatted = Math.abs(change).toFixed(2) + "%";
      return change > 0 ? `+${formatted}` : change < 0 ? `-${formatted}` : "0%";
    };

    res.status(200).json({
      total_sales: currentSales.toFixed(2),
      total_sales_change: calcPercentage(currentSales, prevSales),

      total_outstanding_amount: currentOutstanding.toFixed(2),
      total_outstanding_change: calcPercentage(currentOutstanding, prevOutstanding),

      due_payment_count: currentDueCount,
      due_payment_change: calcPercentage(currentDueCount, prevDueCount),
    });
  } catch (err) {
    console.error("getTopStats error:", err);
    res.status(500).json({ error: err.message });
  }
};


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
      console.log(power)

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
// export const
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
      "Total Price":Number(sale.total_amount),
      "Recieved Amount": Number(sale.recieved_amount),
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

export const updateSaleStatus = async (req, res) => {
  try{
    const {status} =req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    const sale = await Sales.findByIdAndUpdate(req.params.id, {status}, {new:true} );
    if (!sale) return  res.status(404).json({message: "Sale not found"});
    res.status(200).json({message : "Status updated"});
  } catch (err){
    res.status(500).json({error : err.message});
  }
}

export const saleAmountRecieved = async (req, res) =>{
  try{

    const {recieved_amt} = req.body;
    if(!recieved_amt) return res.status(400).json({message:"Amount is required"});

    const sale = await Sales.findById(req.params.id, {
      total_amount: 1,
      recieved_amount: 1
    });

    if(!sale) return res.status(404).json({message:"Sale not Found"})

    const updatedAmount = Number(sale.recieved_amount) + Number(recieved_amt);


    if (updatedAmount > Number(sale.total_amount)) {
      return res.status(400).json({
        message: "Received amount exceeds the total amount due"
      });
    }

    sale.recieved_amount = updatedAmount;
    await sale.save();
    return res.status(200).json({ message: "Amount updated", sale });
  }catch (err){
    return res.status(500).json({ message: "Internal server error" });
  }
}