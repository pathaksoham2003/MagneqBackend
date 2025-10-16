import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Production from "../models/Production.js";
import { getFgModelNumber, getModelNumber } from "../utils/helper.js";
import PaymentRecieval from "../models/PaymentRecieval.js";
import Invoice from "../models/Invoice.js";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { PAYMENT_TERMS } from "../constants/paymentTerms.js";

export const getTopStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);

    // Get invoices for current month (based on invoice_date) for sales calculation
    const currentInvoices = await Invoice.find({
      invoice_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
    }).select("total_invoice_amount customer_id");

    // Get invoices for previous month (based on invoice_date) for sales calculation
    const prevInvoices = await Invoice.find({
      invoice_date: { $gte: prevMonthStart, $lte: prevMonthEnd },
    }).select("total_invoice_amount customer_id");

    // Get ALL invoices for overdue calculation (not limited to current month)
    const allInvoices = await Invoice.find({}).select("total_invoice_amount customer_id due_date invoice_date");

    // Get ALL payments for overdue calculation (not limited to current month)
    const allPaymentsDocs = await PaymentRecieval.find({}).select("amount customer date_of_recieval");

    // --- Aggregation Helpers ---
    const sumAmounts = (arr, field) =>
      arr.reduce((sum, doc) => {
        const val = doc[field]
          ? parseFloat(doc[field].toString())
          : 0;
        return sum + val;
      }, 0);

    // Calculate sales based on invoiced amounts instead of sales orders
    const currentSales = sumAmounts(currentInvoices, "total_invoice_amount");
    const prevSales = sumAmounts(prevInvoices, "total_invoice_amount");

    // Calculate outstanding and overdue amounts per customer
    const calculateOutstandingAndOverdue = (invoices, payments) => {
      const now = new Date();
      
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
          const dueDate = new Date(invoice.due_date);
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

    const currentPaymentData = calculateOutstandingAndOverdue(allInvoices, allPaymentsDocs);
    
    // For previous month comparison, we need to calculate what outstanding/overdue was at the end of previous month
    const prevMonthEndDate = new Date(prevMonthEnd);
    const prevPaymentData = calculateOutstandingAndOverdue(
      allInvoices.filter(inv => new Date(inv.invoice_date) <= prevMonthEndDate),
      allPaymentsDocs.filter(pay => new Date(pay.date_of_recieval) <= prevMonthEndDate)
    );

    // --- Utility for % change ---
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

      total_outstanding_amount: currentPaymentData.totalOutstanding.toFixed(2),
      total_outstanding_change: calcPercentage(
        currentPaymentData.totalOutstanding,
        prevPaymentData.totalOutstanding
      ),

      total_overdue_amount: currentPaymentData.totalOverdue.toFixed(2),
      total_overdue_change: calcPercentage(
        currentPaymentData.totalOverdue,
        prevPaymentData.totalOverdue
      ),

      due_payment_count: currentPaymentData.customersWithOverdue,
      due_payment_change: calcPercentage(
        currentPaymentData.customersWithOverdue,
        prevPaymentData.customersWithOverdue
      ),
    });
  } catch (err) {
    console.error("getTopStats error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const createSale = async (req, res) => {
  try {
    let saleData = {
      ...req.body,
      status: "UN_APPROVED",
      created_by: req.user.id,
    };
    if (req.user.role == "CUSTOMER") {
      saleData = { ...saleData, customer_created_by: req.user.id };
    }

    let totalAmount = 0;
    const updatedFinishedGoods = [];

    for (const item of saleData.finished_goods) {
      const { model, type, ratio, power, rate_per_unit, quantity } = item;

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

    res.status(201).json({ sale: savedSale });
  } catch (err) {
    console.error("Error in createSale:", err);
    res.status(500).json({ error: err.message });
  }
};
// export const
export const approveSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { finished_goods } = req.body;
    const sale = await Sales.findById(id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    if (sale.status !== "UN_APPROVED") {
      return res
        .status(400)
        .json({ error: "Sale is already approved or processed" });
    }

    // If rates are provided, update them before approval
    if (Array.isArray(finished_goods) && finished_goods.length) {
      let totalAmount = 0;
      // Update only the rates for matching fg_id
      sale.finished_goods = sale.finished_goods.map((origItem) => {
        const updateItem = finished_goods.find((fg) => {
          // fg_id can be string or ObjectId, so compare as string
          return fg.fg_id?.toString() === origItem.finished_good.toString();
        });
        if (updateItem) {
          const rate = parseFloat(updateItem.rate_per_unit || 0);
          const quantity = parseFloat(
            updateItem.quantity || origItem.quantity || 0
          );
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
    
    sale.approved_reject_by = req.user.user_name;
    sale.status = "INPROCESS";
    sale.updated_at = new Date();
    await sale.save();

    // Create or update production records for each finished good
    const productionRecords = [];

    for (const item of sale.finished_goods) {
      const fg = await FinishedGoods.findById(item.finished_good);
      if (!fg) continue;

      // Find or create production record for this finished good
      let production = await Production.findOne({
        finished_good: fg._id
      });

      if (production) {
        // Update existing production - add to total quantity and pending production
        production.quantity += item.quantity; // Add to total sales quantity
        production.production_quantity += item.quantity; // Add to pending production
        production.updated_at = new Date()
        await production.save();
      } else {
        // Create new production record
        production = new Production({
          finished_good: fg._id,
          customer_name: "N/A",
          quantity: item.quantity, // Total sales quantity
          production_quantity: item.quantity, // Pending production = total quantity initially
          produced_quantity: 0,
          status: "UN_PROCESSED",
          created_at: new Date(),
          updated_at: new Date(),
        });

        await production.save();
      }
      
      productionRecords.push(production);
    }
    
    res.status(200).json({ 
      message: "Sale approved and production orders created", 
      sale,
      productions: productionRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a rejectSale endpoint
export const rejectSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sales.findById(id);
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }
    if (sale.status !== "UN_APPROVED") {
      return res.status(400).json({ error: "Sale is already processed" });
    }
    sale.approved_reject_by = req.user.user_name;
    sale.status = "CANCELLED";
    sale.updated_at = new Date();
    await sale.save();
    res.status(200).json({ message: "Sale rejected", sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllSales = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchOrderId = req.query.search ? parseInt(req.query.search) : null;

    const query = searchOrderId ? { order_id: searchOrderId } : {};

    if (req.user?.role === "CUSTOMER") {
      query.customer_name = { $regex: `^${req.user.name}$`, $options: 'i' };
      // query.customer_created_by = req.user.id;
    } else if (req.user?.role === "SALES") {
      // query.created_by = new mongoose.Types.ObjectId(req.user.id)
    }
    const totalCount = await Sales.countDocuments(query);

    const sales = await Sales.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "finished_goods.finished_good",
        select: "model type ratio other_specification",
      })
      .populate({
        path: "created_by",
        select: "name user_name role",
      })
      .populate({
        path: "customer_created_by",
        select: "name user_name",
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
    res.status(500).json({ error: err.message });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate("finished_goods.finished_good")
      .populate("created_by")
      .populate("customer_created_by");

    const header = [
      "Order Quantity",
      "Invoiced Quantity",
      "Finished Good",
      "Rate per Unit",
      "Item Total Price",
      "Status",
    ];

    const headerLevelData = {
      "Order Id": sale.order_id,
      "Date of Creation": sale.createdAt,
      "Customer Name": sale.customer_name,
      "Created By":
        sale.created_by?.user_name ||
        sale.customer_created_by?.user_name ||
        "N / A",
      [`${sale.status == "CANCELLED" ? "Rejected by" : "Approved by"}`]:
        sale?.approved_reject_by || " N / A",
      "Total Price": Number(sale.total_amount),
      Status: sale.status,
    };

    const finishedGoods = sale.finished_goods.map((item) => {
      return {
        fg_id: item.finished_good._id,
        quantity: item.quantity,
        invoiced_quantity: item.invoiced_quantity || 0,
        finished_good: getFgModelNumber(item.finished_good),
        rate_per_unit: Number(item.rate_per_unit),
        item_total_price: Number(item.item_total_price),
        base_price: Number(item.finished_good.base_price),
        status: item.status,
        // Add original data for editing
        model: item.finished_good.model,
        type: item.finished_good.type,
        ratio: item.finished_good.ratio,
        power: item.finished_good.power,
      };
    });

    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.status(200).json({
      headerLevelData,
      itemLevelData: { header, items: finishedGoods },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const updateSaleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    const sale = await Sales.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// NEW: Update sales order function (only for UN_APPROVED orders)
export const updateSalesOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sales.findById(id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // Only allow updates for UN_APPROVED orders
    if (sale.status !== "UN_APPROVED") {
      return res.status(400).json({ 
        error: "Only unapproved sales orders can be edited" 
      });
    }

    let updateData = { ...req.body };

    // If finished_goods are being updated, process them
    if (updateData.finished_goods && Array.isArray(updateData.finished_goods)) {
      let totalAmount = 0;
      const updatedFinishedGoods = [];

      for (const item of updateData.finished_goods) {
        const { model, type, ratio, power, quantity, fg_id } = item;

        // Find the finished good
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

        // Use base price for rate_per_unit when editing
        const rate = parseFloat(finishedGood.base_price || 0);
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

      updateData.finished_goods = updatedFinishedGoods;
      updateData.total_amount = totalAmount.toFixed(2);
      updateData.recieved_amount = 0; // Reset received amount when items change
    }

    const allowedUpdates = ['customer_name', 'magneq_user', 'description', 'delivery_date', 'finished_goods', 'total_amount', 'recieved_amount'];
    const filteredUpdateData = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    // Always update the updated_at timestamp
    filteredUpdateData.updated_at = new Date();

    const updatedSale = await Sales.findByIdAndUpdate(
      id, 
      filteredUpdateData, 
      { new: true }
    )
      .populate("finished_goods.finished_good")
      .populate("created_by")
      .populate("customer_created_by");

    if (!updatedSale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.status(200).json({ 
      message: "Sales order updated successfully", 
      sale: updatedSale 
    });
  } catch (err) {
    console.error("Error in updateSalesOrder:", err);
    res.status(500).json({ error: err.message });
  }
};

export const saleAmountRecieved = async (req, res) => {
  try {
    const { recieved_amt } = req.body;
    if (!recieved_amt)
      return res.status(400).json({ message: "Amount is required" });

    const sale = await Sales.findById(req.params.id, {
      total_amount: 1,
      recieved_amount: 1,
    });

    if (!sale) return res.status(404).json({ message: "Sale not Found" });

    const updatedAmount = Number(sale.recieved_amount) + Number(recieved_amt);

    if (updatedAmount > Number(sale.total_amount)) {
      return res.status(400).json({
        message: "Received amount exceeds the total amount due",
      });
    }

    sale.recieved_amount = updatedAmount;
    await sale.save();
    return res.status(200).json({ message: "Amount updated", sale });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getSalesOfCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    // fetch sales with populated finished goods
    const salesOrders = await Sales.find({ created_for: customerId, status: { $eq: "INPROCESS" } })
      .populate("finished_goods.finished_good");

    // transform data for frontend
    const formatted = salesOrders.map((order) => {
      const modelNumbers = (order.finished_goods || [])
        .map((item) => getFgModelNumber(item.finished_good))
        .join(", ");

      return {
        id: order._id,
        order_id: `SO-${order.order_id}`,
        models: modelNumbers,
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    console.error("Error fetching sales orders:", err);
    res.status(500).json({ message: "Server error" });
  }
};
export const deleteSale = async (req, res) => {
  try {
    const deleted = await Sales.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Sale not found" });
    res.status(200).json({ message: "Sale deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFgBySalesId = async (req, res) => {
  try {
    const { salesId } = req.params;

    if (!salesId) {
      return res.status(400).json({ message: "salesId is required" });
    }

    const sales = await Sales.findById(salesId)
      .populate("finished_goods.finished_good");

    if (!sales) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    const formattedFgs = sales.finished_goods.map((fg) => ({
      id: fg.finished_good?._id,
      model_number: getFgModelNumber(fg.finished_good),
      remaining_quantity: Math.max(0, fg.quantity - (fg.invoiced_quantity || 0)), 
      stock_units: fg.finished_good?.units ?? 0,
    }));

    return res.status(200).json(formattedFgs);
  } catch (error) {
    console.error("Error fetching FG by salesId:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
