import Sales from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";

import {startOfMonth, endOfMonth, subMonths} from "date-fns";

export const getTopStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);

    // Aggregations
    const [
      currentSalesAgg,
      prevSalesAgg,
      currentPurchaseAgg,
      prevPurchaseAgg,
      currentProductions,
      prevProductions,
      fgInventoryAgg,
    ] = await Promise.all([
      // Sales (only certain statuses)
      Sales.aggregate([
        { $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
            status: { $in: ["PROCESSED", "DISPATCHED", "DELIVERED","INPROCESS"] }
        } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      Sales.aggregate([
        { $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },  
            status: { $in: ["PROCESSED", "DISPATCHED", "DELIVERED","INPROCESS"] }
        } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),

      // Purchases (only items with status RECIEVED)
      Purchase.aggregate([
        { $match: { created_at: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
        { $unwind: "$items" },
        { $match: { "items.status": "RECIEVED" } },
        { $group: { _id: null, total: { $sum: { $toDouble: "$items.item_total_price" } } } },
      ]),
      Purchase.aggregate([
        { $match: { created_at: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $unwind: "$items" },
        { $match: { "items.status": "RECIEVED" } },
        { $group: { _id: null, total: { $sum: { $toDouble: "$items.item_total_price" } } } },
      ]),

      // Production Orders
      Production.countDocuments({
        createdAt: {$gte: currentMonthStart, $lte: currentMonthEnd},
        status: {$ne: "READY"},
      }),
      Production.countDocuments({
        createdAt: {$gte: prevMonthStart, $lte: prevMonthEnd},
        status: {$ne: "READY"},
      }),

      // FG Inventory (total units, not date-based)
      FinishedGoods.aggregate([{$group: {_id: null, total: {$sum: "$units"}}}]),
    ]);

    // Extract values or fallback
    const currentSales = parseFloat(currentSalesAgg[0]?.total || 0);
    const prevSales = parseFloat(prevSalesAgg[0]?.total || 0);

    const currentPurchase = parseFloat(currentPurchaseAgg[0]?.total || 0);
    const prevPurchase = parseFloat(prevPurchaseAgg[0]?.total || 0);

    const fgInventory = fgInventoryAgg[0]?.total || 0;

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
      total_purchases: currentPurchase.toFixed(2),
      total_purchases_change: calcPercentage(currentPurchase, prevPurchase),
      ongoing_production_orders: currentProductions,
      production_order_change: calcPercentage(
        currentProductions,
        prevProductions
      ),
      current_fg_inventory: fgInventory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
};

export const getSalesTable = async (req, res) => {
  try {
    const sales = await Sales.find()
      .populate("finished_goods.finished_good")
      .sort({createdAt: -1})
      .limit(10);

    const salesTable = sales.flatMap((sale) =>
      sale.finished_goods.map((item) => ({
        order_id: `SO-${sale.order_id}`,
        date: sale.createdAt.toISOString().split("T")[0],
        customer_name: sale.customer_name,
        model: item.finished_good?.model || "-",
        type: item.finished_good?.type || "-",
        ratio: item.finished_good?.ratio || "-",
        quantity: item.quantity,
        status: sale.status,
      }))
    );

    res.status(200).json(salesTable);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

// MONTHLY SALES & REVENUE STATISTICS
export const getSalesStatistics = async (req, res) => {
  try {
    const monthlySales = await Sales.aggregate([
      { $match: { status: { $nin: ["PROCESSED", "DISPATCHED", "DELIVERED", "CANCELLED"] } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthNames = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const statistics = {
      months: [],
      sales: [],
      revenue: [],
    };

    for (let i = 1; i <= 12; i++) {
      const entry = monthlySales.find((m) => m._id === i);
      statistics.months.push(monthNames[i]);
      statistics.sales.push(entry?.salesCount || 0);
      statistics.revenue.push(entry?.totalRevenue?.toString() || "0");
    }

    res.status(200).json(statistics);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
