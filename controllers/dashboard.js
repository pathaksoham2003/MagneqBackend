import Sales from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import Production from "../models/Production.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Invoice from "../models/Invoice.js";
import Ledger from "../models/Ledger.js";
import mongoose from "mongoose";

import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import PaymentRecieval from "../models/PaymentRecieval.js";
import { PAYMENT_TERMS } from "../constants/paymentTerms.js";
import logger from "../utils/logger.js";

export const getTopStats = async (req, res, next) => {
  try {
    // Use IST timezone for consistent date calculations
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);

    // Get all invoices and payments for outstanding/overdue calculations
    const [allInvoices, allPaymentsDocs] = await Promise.all([
      Invoice.find({}).select("total_invoice_amount customer_id due_date invoice_date"),
      PaymentRecieval.find({}).select("amount customer date_of_recieval")
    ]);

    // Calculate outstanding and overdue amounts
    const calculateOutstandingAndOverdue = (invoices, payments) => {
      // Use IST timezone for consistent date calculations
      const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      
      // Group invoices by customer
      const invoicesByCustomer = {};
      invoices.forEach(invoice => {
        const customerId = invoice.customer_id.toString();
        if (!invoicesByCustomer[customerId]) {
          invoicesByCustomer[customerId] = [];
        }
        invoicesByCustomer[customerId].push({
          amount: parseFloat(invoice.total_invoice_amount?.toString() || 0),
          due_date: invoice.due_date,
          invoice_date: invoice.invoice_date
        });
      });

      // Group payments by customer (total payments per customer)
      const paymentsByCustomer = {};
      payments.forEach(payment => {
        const customerId = payment.customer.toString();
        if (!paymentsByCustomer[customerId]) {
          paymentsByCustomer[customerId] = 0;
        }
        paymentsByCustomer[customerId] += parseFloat(payment.amount?.toString() || 0);
      });

      // Calculate outstanding and overdue amounts per customer
      let totalOutstanding = 0;
      let totalOverdue = 0;
      let customersWithOutstanding = 0;
      let customersWithOverdue = 0;

      Object.keys(invoicesByCustomer).forEach(customerId => {
        const customerInvoices = invoicesByCustomer[customerId];
        const totalPaid = paymentsByCustomer[customerId] || 0;
        
        let customerOutstanding = 0;
        let customerOverdue = 0;
        let totalInvoiced = 0;
        let totalOverdueInvoiced = 0;
        
        // Calculate total invoiced amounts
        customerInvoices.forEach(invoice => {
          totalInvoiced += invoice.amount;
          
          // Check if invoice is overdue
          const dueDate = new Date(new Date(invoice.due_date).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          if (dueDate < now) {
            totalOverdueInvoiced += invoice.amount;
          }
        });
        
        // Calculate outstanding amount (total invoiced - total payments)
        if (totalInvoiced > 0) {
          customerOutstanding = Math.max(0, totalInvoiced - totalPaid);
        }
        
        // Calculate overdue amount (total overdue invoiced - total payments)
        if (totalOverdueInvoiced > 0) {
          customerOverdue = Math.max(0, totalOverdueInvoiced - totalPaid);
        }
        
        totalOutstanding += customerOutstanding;
        totalOverdue += customerOverdue;
        
        if (customerOutstanding > 0) {
          customersWithOutstanding++;
        }
        if (customerOverdue > 0) {
          customersWithOverdue++;
        }
      });

      return { 
        totalOutstanding, 
        totalOverdue, 
        customersWithOutstanding, 
        customersWithOverdue 
      };
    };

    const paymentData = calculateOutstandingAndOverdue(allInvoices, allPaymentsDocs);

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
      // Sales based on invoices (invoice_date) instead of sales orders
      Invoice.aggregate([
        {
          $match: {
            invoice_date: { $gte: currentMonthStart, $lte: currentMonthEnd }
          }
        },
        { $group: { _id: null, total: { $sum: { $toDouble: "$total_invoice_amount" } } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            invoice_date: { $gte: prevMonthStart, $lte: prevMonthEnd }
          }
        },
        { $group: { _id: null, total: { $sum: { $toDouble: "$total_invoice_amount" } } } },
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
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
        status: { $ne: "READY" },
      }),
      Production.countDocuments({
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
        status: { $ne: "READY" },
      }),

      // FG Inventory (total units, not date-based)
      FinishedGoods.aggregate([{ $group: { _id: null, total: { $sum: "$units" } } }]),
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
      total_outstanding_amount: paymentData.totalOutstanding.toFixed(2),
      total_overdue_amount: paymentData.totalOverdue.toFixed(2),
      customers_with_outstanding: paymentData.customersWithOutstanding,
      customers_with_overdue: paymentData.customersWithOverdue,
    });
  } catch (err) {
    next(err);
  }
};

export const getTopCustomerStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid customer ID format" 
      });
    }

    const customerId = mongoose.Types.ObjectId.createFromHexString(id);
    
    // Get ALL ledger entries for the customer (complete history - no date filtering)
    const allLedgerEntries = await Ledger.find({ 
      customer_id: customerId 
    })
    .populate('invoice_id', 'due_date') // Populate invoice to get due_date for overdue calculation
    .sort({ date: 1, createdAt: 1 })
    .lean();
    
    // Separate DEBIT and CREDIT entries
    const debitEntries = allLedgerEntries.filter(entry => entry.type === "DEBIT");
    const creditEntries = allLedgerEntries.filter(entry => entry.type === "CREDIT");
    
    // Calculate total sales = sum of all DEBIT entries
    const totalOrderAmount = debitEntries.reduce((sum, entry) => {
      const amount = entry.amount ? parseFloat(entry.amount.toString()) : 0;
      return sum + amount;
    }, 0);
    
    // Calculate total payment received = sum of all CREDIT entries
    const totalPaymentReceived = creditEntries.reduce((sum, entry) => {
      const amount = entry.amount ? parseFloat(entry.amount.toString()) : 0;
      return sum + amount;
    }, 0);

    // Get outstanding amount from the latest running_balance
    // If no entries exist, outstanding is 0
    let outstandingAmount = 0;
    let overpaidAmount = 0;
    
    if (allLedgerEntries.length > 0) {
      // Get the latest entry (last one after sorting by date)
      const latestEntry = allLedgerEntries[allLedgerEntries.length - 1];
      const runningBalance = latestEntry.running_balance 
        ? parseFloat(latestEntry.running_balance.toString()) 
        : 0;
      
      // If running balance is positive, it's outstanding amount
      // If running balance is negative, it's overpaid amount
      if (runningBalance > 0) {
        outstandingAmount = runningBalance;
      } else if (runningBalance < 0) {
        overpaidAmount = Math.abs(runningBalance);
      }
    }

    // Calculate overdue payment based on invoices older than 45 days
    // Use IST timezone for consistent date calculations
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const fortyFiveDaysAgo = new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000));
    
    // Get DEBIT entries that have invoice_id (actual invoices, not admin-added entries)
    // and are older than 45 days
    const invoiceDebitEntries = debitEntries
      .filter(entry => entry.invoice_id) // Only entries with invoice_id (actual invoices)
      .map(entry => {
        const entryDate = new Date(new Date(entry.date).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        return {
          ...entry,
          amount: parseFloat(entry.amount.toString()),
          entryDate: entryDate,
          isOverdue: entryDate < fortyFiveDaysAgo
        };
      })
      .sort((a, b) => a.entryDate - b.entryDate); // Sort by date (oldest first)
    
    // Sort CREDIT entries by date (oldest first) for FIFO allocation
    const sortedCreditEntries = creditEntries
      .map(entry => ({
        amount: parseFloat(entry.amount.toString()),
        entryDate: new Date(new Date(entry.date).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
      }))
      .sort((a, b) => a.entryDate - b.entryDate);
    
    // Allocate payments (CREDIT entries) to invoices (DEBIT entries) using FIFO
    let remainingPayment = totalPaymentReceived;
    let overduePayment = 0;
    
    for (const debitEntry of invoiceDebitEntries) {
      if (remainingPayment <= 0) {
        // No more payments to allocate, check if this invoice is overdue
        if (debitEntry.isOverdue) {
          overduePayment += debitEntry.amount;
        }
      } else {
        // Allocate payment to this invoice
        const paymentToAllocate = Math.min(remainingPayment, debitEntry.amount);
        remainingPayment -= paymentToAllocate;
        
        // Check if this invoice is overdue and has remaining unpaid amount
        if (debitEntry.isOverdue) {
          const unpaidAmount = debitEntry.amount - paymentToAllocate;
          overduePayment += Math.max(0, unpaidAmount);
        }
      }
    }

    // Count total invoices = number of DEBIT entries with invoice_id
    const totalInvoices = debitEntries.filter(entry => entry.invoice_id).length;

    // Average invoice value = total sales / total invoices
    const averageInvoiceValue = totalInvoices > 0 ? totalOrderAmount / totalInvoices : 0;

    const customerStats = {
      totalOrderAmount: parseFloat(totalOrderAmount.toFixed(2)),
      totalPaymentReceived: parseFloat(totalPaymentReceived.toFixed(2)),
      totalOutstandingPayment: parseFloat(outstandingAmount.toFixed(2)), // from running_balance
      totalOverheadPayment: parseFloat(overpaidAmount.toFixed(2)),
      totalOverduePayment: parseFloat(overduePayment.toFixed(2)),
      totalInvoices,
      averageInvoiceValue: parseFloat(averageInvoiceValue.toFixed(2)),
    };

    res.status(200).json(customerStats);

  } catch (error) {
    next(error);
  }
};

export const getSalesTable = async (req, res, next) => {
  try {
    const sales = await Sales.find()
      .populate("finished_goods.finished_good")
      .sort({ createdAt: -1 })
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
    res.status(500).json({ error: err.message });
  }
};

// MONTHLY SALES & REVENUE STATISTICS
export const getSalesStatistics = async (req, res, next) => {
  try {
    const monthlySales = await Invoice.aggregate([
      {
        $group: {
          _id: { $month: "$invoice_date" },
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: "$total_invoice_amount" } },
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
    next(err);
  }
};
