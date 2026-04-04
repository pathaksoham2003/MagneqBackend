import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Production from "../models/Production.js";
import { getFgModelNumber, getModelNumber } from "../utils/helper.js";
import PaymentRecieval from "../models/PaymentRecieval.js";
import Invoice from "../models/Invoice.js";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { PAYMENT_TERMS } from "../constants/paymentTerms.js";
import { calculateTaxes } from "../utils/taxCalculator.js";
import Customers from "../models/Customers.js";
import logger from "../utils/logger.js";

export const getTopStats = async (req, res, next) => {
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
    next(err);
  }
};

export const createSale = async (req, res, next) => {
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

    logger.info(`Sales order created: SO-${savedSale.order_id} for ${savedSale.customer_name}`);
    res.status(201).json({ sale: savedSale });
  } catch (err) {
    next(err);
  }
};
// export const
export const approveSale = async (req, res, next) => {
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
    
    logger.info(`Sales order approved: SO-${sale.order_id}. ${productionRecords.length} production orders updated/created.`);
    res.status(200).json({ 
      message: "Sale approved and production orders created", 
      sale,
      productions: productionRecords
    });
  } catch (err) {
    next(err);
  }
};

// Add a rejectSale endpoint
export const rejectSale = async (req, res, next) => {
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
    logger.warn(`Sales order rejected: SO-${sale.order_id} by ${req.user.user_name}`);
    res.status(200).json({ message: "Sale rejected", sale });
  } catch (err) {
    next(err);
  }
};

export const getAllSales = async (req, res, next) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchOrderId = req.query.search ? parseInt(req.query.search) : null;
    const userId = req.query.user_id;
    const userRole = req.query.user_role;

    const query = searchOrderId ? { order_id: searchOrderId } : {};

    // Apply role-based filtering using query parameters
    if (userRole === "CUSTOMER" && userId) {
      // Customer: Get sales orders where created_for field matches customer ID
      query.created_for = userId;
    } else if ((userRole === "SALES" || userRole === "PRODUCTION") && userId) {
      // Non-admin users: Get sales orders where created_by field matches user ID
      query.created_by = userId;
    }
    // ADMIN role or no user_id: No additional filtering - gets all sales orders
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
      })
      .populate({
        path: "created_for",
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
    next(err);
  }
};

export const getSaleById = async (req, res, next) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate("finished_goods.finished_good")
      .populate("created_by")
      .populate("customer_created_by")
      .populate("created_for");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // Determine if it's inter-state based on customer state
    let isInterState = true; // Default to inter-state
    if (sale.created_for?.state) {
      isInterState = sale.created_for.state.toUpperCase() !== "MAHARASHTRA";
    }

    const header = [
      "Order Quantity",
      "Invoiced Quantity",
      "Finished Good",
      "Rate per Unit",
      "Item Total Price",
      "Tax Details",
      "Total with Tax",
      "Status",
    ];

    // Calculate tax-inclusive amounts for each item
    let totalTaxAmount = 0;
    let totalWithTax = 0;

    const finishedGoods = await Promise.all(sale.finished_goods.map(async (item) => {
      const rate = Number(item.rate_per_unit);
      const quantity = item.quantity;
      const amount = rate * quantity;
      
      // Calculate taxes for this item
      const taxes = await calculateTaxes(item.finished_good._id, amount, isInterState);
      const itemTaxAmount = taxes.reduce((sum, tax) => sum + tax.amount, 0);
      const itemTotalWithTax = amount + itemTaxAmount;
      
      totalTaxAmount += itemTaxAmount;
      totalWithTax += itemTotalWithTax;

      // Calculate item status based on sales order status and invoicing
      let itemStatus = "PENDING";
      if (sale.status === "UN_APPROVED" || sale.status === "CANCELLED") {
        itemStatus = "PENDING";
      } else if (sale.status === "INPROCESS") {
        if (item.invoiced_quantity >= item.quantity) {
          itemStatus = "PROCESSED";
        } else {
          itemStatus = "INPROCESS";
        }
      } else if (sale.status === "PROCESSED") {
        itemStatus = "PROCESSED";
      }

      return {
        fg_id: item.finished_good._id,
        quantity: item.quantity,
        invoiced_quantity: item.invoiced_quantity || 0,
        finished_good: getFgModelNumber(item.finished_good),
        rate_per_unit: rate,
        item_total_price: amount,
        tax_details: taxes.map(tax => ({
          type: tax.type,
          percentage: tax.percentage,
          amount: parseFloat(tax.amount.toFixed(2))
        })),
        total_with_tax: parseFloat(itemTotalWithTax.toFixed(2)),
        base_price: Number(item.finished_good.base_price),
        status: itemStatus,
        // Add original data for editing
        model: item.finished_good.model,
        type: item.finished_good.type,
        ratio: item.finished_good.ratio,
        power: item.finished_good.power,
      };
    }));

    const headerLevelData = {
      "Order Id": sale.order_id,
      "Date of Creation": sale.createdAt,
      "Customer Name": sale.customer_name,
      "Customer State": sale.created_for?.state || "N/A",
      "Created By":
        sale.created_by?.user_name ||
        sale.customer_created_by?.user_name ||
        "N / A",
      [`${sale.status == "CANCELLED" ? "Rejected by" : "Approved by"}`]:
        sale?.approved_reject_by || " N / A",
      "Sub Total": parseFloat(Number(sale.total_amount).toFixed(2)),
      "Total Tax Amount": parseFloat(totalTaxAmount.toFixed(2)),
      "Total with Tax": parseFloat(totalWithTax.toFixed(2)),
      Status: sale.status,
    };

    res.status(200).json({
      headerLevelData,
      itemLevelData: { header, items: finishedGoods },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSaleStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    const sale = await Sales.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    
    const oldStatus = sale.status;
    
    // Update the status
    sale.status = status;
    sale.updated_at = new Date();
    await sale.save();
    
    // If status changed to CANCELLED and it was previously approved, reduce production quantities
    if (status === "CANCELLED" && oldStatus !== "UN_APPROVED" && oldStatus !== "CANCELLED") {
      await reduceProductionQuantitiesOnSalesDeletion(sale);
    }
    
    logger.info(`Sales order status updated: SO-${sale.order_id} (${oldStatus} -> ${status})`);
    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    next(err);
  }
};
// NEW: Update sales order function (UN_APPROVED orders for all roles, approved orders for ADMIN only)
export const updateSalesOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const sale = await Sales.findById(id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const effectiveRole = userRole || req.user?.role;
    const isAdmin = effectiveRole?.toUpperCase() === "ADMIN";
    
    if (sale.status !== "UN_APPROVED" && !isAdmin) {
      return res.status(400).json({ 
        error: "Only administrators can edit approved sales orders" 
      });
    }

    // Debug logging
    console.log("Update Sales Order Debug:", {
      saleId: id,
      saleStatus: sale.status,
      userRole: userRole,
      effectiveRole: effectiveRole,
      effectiveRoleUpper: effectiveRole?.toUpperCase(),
      userObject: req.user,
      reqUserRole: req.user?.role,
      reqUserRoleUpper: req.user?.role?.toUpperCase(),
      canEdit: sale.status === "UN_APPROVED" || isAdmin,
      isUnapproved: sale.status === "UN_APPROVED",
      isAdmin: isAdmin,
      willBlock: sale.status !== "UN_APPROVED" && !isAdmin,
      condition1: sale.status !== "UN_APPROVED",
      condition2: !isAdmin,
      explanation: isAdmin ? "Admin can edit any order" : 
                   sale.status === "UN_APPROVED" ? "Non-admin can edit unapproved orders" : 
                   "Non-admin cannot edit approved orders"
    });

    // For approved orders, only ADMIN can edit
    if (sale.status !== "UN_APPROVED" && isAdmin) {
      // Additional validations for admin editing approved orders will be added below
    }

    let updateData = { ...req.body };

    // If finished_goods are being updated, process them
    if (updateData.finished_goods && Array.isArray(updateData.finished_goods)) {
      let totalAmount = 0;
      const updatedFinishedGoods = [];

      // For admin editing approved orders, validate against invoiced quantities
      if (sale.status !== "UN_APPROVED" && isAdmin) {
        // Check if any items are being removed that have invoiced quantities
        for (const existingItem of sale.finished_goods) {
          const isStillPresent = updateData.finished_goods.some(newItem => 
            newItem.fg_id && newItem.fg_id.toString() === existingItem.finished_good.toString()
          );
          
          if (!isStillPresent && (existingItem.invoiced_quantity || 0) > 0) {
            return res.status(400).json({
              error: `Cannot remove item with invoiced quantity. Item has ${existingItem.invoiced_quantity} invoiced units.`,
              item: existingItem
            });
          }
        }

        // Check for duplicate items in the new data
        const seenItems = new Set();
        for (const item of updateData.finished_goods) {
          const itemKey = `${item.model}-${item.type}-${item.ratio}-${item.power}`;
          if (seenItems.has(itemKey)) {
            return res.status(400).json({
              error: `Duplicate item found: ${item.model} ${item.type} ${item.ratio} ${item.power}. Please increase/decrease the existing quantity instead.`,
              item
            });
          }
          seenItems.add(itemKey);
        }
      }

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

        // For admin editing approved orders, validate quantity changes
        if (sale.status !== "UN_APPROVED" && isAdmin && fg_id) {
          const existingItem = sale.finished_goods.find(existing => 
            existing.finished_good.toString() === fg_id.toString()
          );
          
          if (existingItem) {
            const newQuantity = parseFloat(quantity || 0);
            const invoicedQuantity = existingItem.invoiced_quantity || 0;
            
            if (newQuantity < invoicedQuantity) {
              return res.status(400).json({
                error: `Cannot reduce quantity below invoiced amount. Current invoiced: ${invoicedQuantity}, New quantity: ${newQuantity}`,
                item: { fg_id, invoiced_quantity: invoicedQuantity, new_quantity: newQuantity }
              });
            }
          }
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
          // Preserve invoiced_quantity for existing items
          ...(fg_id && sale.finished_goods.find(existing => 
            existing.finished_good.toString() === fg_id.toString()
          ) ? {
            invoiced_quantity: sale.finished_goods.find(existing => 
              existing.finished_good.toString() === fg_id.toString()
            ).invoiced_quantity || 0
          } : {})
        });
      }

      updateData.finished_goods = updatedFinishedGoods;
      updateData.total_amount = totalAmount.toFixed(2);
      
      // Only reset received amount for unapproved orders
      if (sale.status === "UN_APPROVED") {
        updateData.recieved_amount = 0;
      }
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

    // Update production quantities if finished goods were modified and order is approved
    if (updateData.finished_goods && sale.status !== "UN_APPROVED") {
      await updateProductionQuantitiesForSalesOrder(sale, updatedSale);
    }

    logger.info(`Sales order updated: SO-${updatedSale.order_id} by ${req.user.user_name}`);
    res.status(200).json({ 
      message: "Sales order updated successfully", 
      sale: updatedSale 
    });
  } catch (err) {
    next(err);
  }
};

export const saleAmountRecieved = async (req, res, next) => {
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
    logger.info(`Payment received for SO-${sale.order_id}: ${recieved_amt}. New total: ${updatedAmount}`);
    return res.status(200).json({ message: "Amount updated", sale });
  } catch (err) {
    next(err);
  }
};

export const getSalesOfCustomer = async (req, res, next) => {
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
    next(err);
  }
};
export const deleteSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    
    const sale = await Sales.findById(id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // Check if any items have invoiced quantities
    const hasInvoicedItems = sale.finished_goods.some(item => (item.invoiced_quantity || 0) > 0);
    
    if (hasInvoicedItems) {
      return res.status(400).json({ 
        message: "Cannot delete sales order with invoiced items." 
      });
    }

    // Only ADMIN can delete sales orders
    if (userRole?.toUpperCase() !== "ADMIN") {
      return res.status(403).json({ 
        message: "Only administrators can delete sales orders" 
      });
    }

    // Reduce production quantities before deleting the sales order
    if (sale.status !== "UN_APPROVED") {
      await reduceProductionQuantitiesOnSalesDeletion(sale);
    }

    const deleted = await Sales.findByIdAndDelete(id);
    logger.warn(`Sales order deleted: SO-${sale.order_id} by ${req.user.user_name}`);
    res.status(200).json({ message: "Sale deleted and production updated" });
  } catch (err) {
    next(err);
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
    next(error);
  }
};

// Helper function to update production quantities when sales order is modified
const updateProductionQuantitiesForSalesOrder = async (originalSale, updatedSale) => {
  try {
    // Create maps for easy comparison
    const originalItems = new Map();
    const updatedItems = new Map();

    originalSale.finished_goods.forEach(item => {
      originalItems.set(item.finished_good.toString(), item.quantity);
    });

    updatedSale.finished_goods.forEach(item => {
      updatedItems.set(item.finished_good.toString(), item.quantity);
    });

    // Process all finished goods that were in original or updated sale
    const allFgIds = new Set([...originalItems.keys(), ...updatedItems.keys()]);

    for (const fgId of allFgIds) {
      const originalQty = originalItems.get(fgId) || 0;
      const updatedQty = updatedItems.get(fgId) || 0;
      const quantityChange = updatedQty - originalQty;

      if (quantityChange !== 0) {
        // Find production record for this finished good
        const production = await Production.findOne({
          finished_good: fgId
        });

        if (production) {
          // Update production quantity based on the change
          production.production_quantity = Math.max(0, production.production_quantity + quantityChange);
          production.updated_at = new Date();
          await production.save();

          logger.info(`Updated production for FG ${fgId}: production_quantity changed by ${quantityChange}`);
        }
      }
    }
  } catch (error) {
    logger.error("Error updating production quantities:", error);
  }
};

// Helper function to reduce production quantities when sales order is deleted
const reduceProductionQuantitiesOnSalesDeletion = async (sale) => {
  try {
    for (const item of sale.finished_goods) {
      // Find production record for this finished good
      const production = await Production.findOne({
        finished_good: item.finished_good
      });

      if (production) {
        // Reduce production quantity by the sales order quantity
        production.production_quantity = Math.max(0, production.production_quantity - item.quantity);
        production.updated_at = new Date();
        await production.save();

        logger.info(`Updated production for FG ${item.finished_good}: reduced quantity by ${item.quantity}`);
      }
    }
  } catch (error) {
    logger.error("Error reducing production quantities on sales deletion:", error);
  }
};
