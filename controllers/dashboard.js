import Sales from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";

// TOP CARDS METRICS
export const getTopStats = async (req, res) => {
  try {
    const [salesAgg, purchaseAgg, ongoingProductions, fgInventoryAgg] =
      await Promise.all([
        Sales.aggregate([{ $group: { _id: null, total: { $sum: "$total_amount" } } }]),
        Purchase.aggregate([{ $group: { _id: null, total: { $sum: "$total_price" } } }]),
        Production.countDocuments({ status: { $ne: "READY" } }),
        FinishedGoods.aggregate([{ $group: { _id: null, total: { $sum: "$units" } } }]),
      ]);

    res.status(200).json({
      total_sales: salesAgg[0]?.total?.toString() || "0",
      total_purchases: purchaseAgg[0]?.total?.toString() || "0",
      ongoing_production_orders: ongoingProductions,
      current_fg_inventory: fgInventoryAgg[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SALES TABLE DATA
export const getSalesTable = async (req, res) => {
  try {
    const sales = await Sales.find()
      .populate("finished_goods.finished_good")
      .sort({ createdAt: -1 })
      .limit(10);

    const salesTable = sales.flatMap(sale =>
      sale.finished_goods.map(item => ({
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
    res.status(500).json({ error: err.message });
  }
};

// MONTHLY SALES & REVENUE STATISTICS
export const getSalesStatistics = async (req, res) => {
  try {
    const monthlySales = await Sales.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: "$total_amount" },
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const monthNames = [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const statistics = {
      months: [],
      sales: [],
      revenue: [],
    };

    for (let i = 1; i <= 12; i++) {
      const entry = monthlySales.find(m => m._id === i);
      statistics.months.push(monthNames[i]);
      statistics.sales.push(entry?.salesCount || 0);
      statistics.revenue.push(entry?.totalRevenue?.toString() || "0");
    }

    res.status(200).json(statistics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
