import Invoice from "../models/Invoice.js";
import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import Production from "../models/Production.js";
import { calculateTaxes } from "../utils/taxCalculator.js";
import Customers from "../models/Customers.js";
import { formatDateTime, getFgModelNumber } from "../utils/helper.js";
import Ledger from "../models/Ledger.js";
import { PAYMENT_TERMS } from "../constants/paymentTerms.js";
import puppeteer from "puppeteer";
import { getLastRunningBalance } from "../utils/ledgerUtils.js";
import FgHistory from "../models/FgHistory.js";
import logger from "../utils/logger.js";


export const createInvoice = async (req, res, next) => {
  try {
    const { sales_id, customer_id, items } = req.body;

    const sales = await Sales.findById(sales_id);
    if (!sales) return res.status(404).json({ message: "Sales order not found" });

    const customer = await Customers.findById(customer_id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const isInterState = customer.state?.toUpperCase() !== "MAHARASHTRA";

    // 2. Process items
    let totalInvoiceAmount = 0;
    let processedItems = [];

    for (const { fg_id, quantity } of items) {
      const fg = await FinishedGoods.findById(fg_id);
      if (!fg) return res.status(404).json({ message: `Finished good not found: ${fg_id}` });

      const salesItem = sales.finished_goods.find(
        (item) => item.finished_good.toString() === fg_id.toString()
      );
      if (!salesItem) {
        return res.status(400).json({ message: `Finished good not part of this sales order: ${fg_id}` });
      }

      // ✅ Prevent over-invoicing
      if (salesItem.invoiced_quantity + quantity > salesItem.quantity) {
        return res.status(400).json({
          message: `Cannot invoice more than ordered quantity for FG: ${fg_id}`,
        });
      }

      // ✅ Check stock availability
      const currentStock = fg.units || 0;
      if (currentStock < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for FG: ${fg_id}. Available: ${currentStock}, Required: ${quantity}`,
        });
      }

      const rate = parseFloat(salesItem.rate_per_unit.toString());
      const gstRate = parseFloat(fg.gst_slab.toString());
      const amount = rate * quantity;

      let taxEntries = [];
      let totalWithTax = amount;

      if (isInterState) {
        // IGST
        const taxAmount = (amount * gstRate) / 100;
        taxEntries.push({ type: "IGST", percentage: gstRate, amount: taxAmount });
        totalWithTax += taxAmount;
      } else {
        // CGST + SGST
        const halfRate = gstRate / 2;
        const halfAmount = (amount * halfRate) / 100;
        taxEntries.push({ type: "CGST", percentage: halfRate, amount: halfAmount });
        taxEntries.push({ type: "SGST", percentage: halfRate, amount: halfAmount });
        totalWithTax += halfAmount * 2;
      }

      totalInvoiceAmount += totalWithTax;

      processedItems.push({
        sales_item: fg_id,
        finished_good: fg._id, // Keep for backward compatibility
        finished_good_snapshot: {
          model: fg.model,
          type: fg.type,
          ratio: fg.ratio,
          power: fg.power,
          other_specification: fg.other_specification,
          gst_slab: fg.gst_slab,
        },
        description: `${fg.model} ${fg.type} ${fg.ratio} ${fg.power}`,
        invoiced_quantity: quantity,
        rate_per_unit: rate,
        invoiced_amount: amount,
        taxes: taxEntries,
        total_with_tax: totalWithTax,
      });

      // 🔹 Update invoiced_quantity for tracking
      salesItem.invoiced_quantity += quantity;
      salesItem.total_invoiced_quantity = salesItem.invoiced_quantity;
    }

    // 3. Calculate due_date = delivery_date + PAYMENT_TERMS.DUE_DATE_DAYS days
    let dueDate = null;
    if (sales.delivery_date) {
      dueDate = new Date(sales.delivery_date);
      dueDate.setDate(dueDate.getDate() + PAYMENT_TERMS.DUE_DATE_DAYS);
    }

    // 4. Save invoice
    const invoice = await Invoice.create({
      sales_id,
      customer_id,
      items: processedItems,
      due_date: dueDate,
      total_invoice_amount: totalInvoiceAmount,
    });

    // 5. Save updated Sales (with new invoiced quantities)
    await sales.save();

    // 6. Reduce stock quantities for invoiced finished goods
    for (const { fg_id, quantity } of items) {
      const updatedFg = await FinishedGoods.findByIdAndUpdate(
        fg_id,
        { $inc: { units: -quantity } }, // Reduce stock by invoiced quantity
        { new: true }
      );
      
      if (updatedFg) {
        await FgHistory.create({
          finished_good_id: updatedFg._id,
          model: updatedFg.model,
          type: updatedFg.type,
          change_type: "INVOICE_REDUCTION",
          quantity_changed: quantity,
          current_quantity: updatedFg.units,
          reference_text: `Invoice #${invoice.invoice_number}`,
          changed_by: req.user ? {
            user_id: req.user.id,
            name: req.user.name,
            user_name: req.user.user_name,
            email: req.user.email
          } : undefined
        });
      }
    }

    // 6.1. Update production quantities - reduce by invoiced amounts
    await updateProductionQuantitiesOnInvoicing(items);

    // 7. Create ledger entry for the invoice (Debit)
    const previousBalance = await getLastRunningBalance(customer_id);

    // Debit increases balance
    const newRunningBalance = previousBalance + totalInvoiceAmount;

    const ledgerEntry = await Ledger.create({
      customer_id: customer_id,
      invoice_id: invoice._id,
      date: new Date(),
      type: "DEBIT",
      amount: totalInvoiceAmount,
      details: `Invoice #${invoice.invoice_number} created`,
      running_balance: newRunningBalance, // ✅ store calculated balance
    });

    // 8. 🔹 Check if ALL items are fully invoiced
    const allInvoiced = sales.finished_goods.every(
      (item) => item.invoiced_quantity >= item.quantity
    );

    if (allInvoiced) {
      sales.status = "PROCESSED";
      await sales.save();
    }

    logger.info(`Invoice created: ${invoice.invoice_number} for customer ${customer.name}`);
    return res.status(201).json({
      message: "Invoice created, stock updated & ledger updated",
      invoice,
      ledgerEntry,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllInvoices = async (req, res, next) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchQuery = req.query.search;
    const customerId = req.query.customer_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const userId = req.query.user_id;
    const userRole = req.query.user_role;

    // Build base query
    let query = {};

    // Apply role-based filtering
    if (userRole === "SALES" && userId) {
      // For sales users, only show invoices for sales orders they created
      query["sales_id.created_by"] = userId;
    } else if (userRole === "CUSTOMER" && userId) {
      // For customers, only show their own invoices
      query.customer_id = userId;
    }
    // ADMIN role: No additional filtering - gets all invoices

    // Filter by customer ID if provided (overrides role-based customer filtering)
    if (customerId) {
      query.customer_id = customerId;
    }

    // Add date filtering
    if (startDate || endDate) {
      query.invoice_date = {};
      if (startDate) {
        query.invoice_date.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to end date to include the entire end date
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        query.invoice_date.$lt = endDateObj;
      }
    }

    // Add search functionality
    if (searchQuery) {
      const searchNumber = parseInt(searchQuery);
      if (!isNaN(searchNumber)) {
        // Search by invoice number
        query.invoice_number = searchNumber;
      } else {
        // Search by customer name (only if no specific customer filter)
        if (!customerId) {
          query.$or = [
            { "customer_id.name": { $regex: searchQuery, $options: "i" } },
            { "customer_id.user_name": { $regex: searchQuery, $options: "i" } }
          ];
        }
      }
    }

    const totalCount = await Invoice.countDocuments(query);

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNo - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate({
        path: "sales_id",
        populate: {
          path: "finished_goods.finished_good",
          select: "model type ratio power other_specification",
        },
        select: "order_id created_by",
      })
      .populate({
        path: "customer_id",
        select: "name user_name state gst_no",
      });

    const items = invoices.map((inv) => {
      const invoiceDetails = inv.items.map((it) => {
        // Use stored snapshot if available, otherwise fall back to populated data
        let fgData;
        if (it.finished_good_snapshot) {
          fgData = it.finished_good_snapshot;
        } else {
          fgData = inv.sales_id?.finished_goods.find(
            (fg) => fg.finished_good?._id.toString() === it.finished_good?.toString()
          )?.finished_good;
        }
        return `${getFgModelNumber(fgData)}/${it.invoiced_quantity}`;
      });

      return {
        id: inv._id,
        data: [
          `INV-${inv.invoice_number}`,
          inv.invoice_date,
          inv.customer_id?.name,
          invoiceDetails,
          inv.status,
        ],
      };
    });

    res.status(200).json({
      header: [
        "Invoice No",
        "Invoice Date",
        "Customer Name",
        "Invoice Details",
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

export const getInvoicesBySalesId = async (req, res, next) => {
  try {
    const { salesId } = req.params;
    const invoices = await Invoice.find({ sales_id: salesId })
      .populate("sales_id")
      .populate("customer_id");

    if (!invoices.length) {
      return res.status(404).json({ message: "No invoices found for this Sales ID" });
    }

    return res.status(200).json(invoices);
  } catch (err) {
    next(err);
  }
};

export const getInvoicesByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    // No role-based access control - customer ID comes from query parameter

    // find invoices for that customer, populate sales order_id
    const invoices = await Invoice.find({ customer_id: customerId })
      .populate({
        path: "sales_id",
        select: "order_id", // only return order_id from sales
      })
      .select("invoice_number invoice_date sales_id") // only pick needed fields
      .sort({ invoice_date: -1 });

    // map into frontend response format
    const items = invoices.map((inv) => ({
      id: inv._id,
      invoice_number: inv.invoice_number,
      sales_order_number: inv.sales_id ? `SO-${inv.sales_id.order_id}` : null,
      invoice_date: inv.invoice_date,
    }));

    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
};

export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    const invoiceDoc = await Invoice.findById(id)
      .populate("sales_id", "sales_order_number")
      .populate("customer_id")
      .populate("items.finished_good");

    if (!invoiceDoc) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // No role-based access control - access controlled by frontend query parameters

    // convert to plain object
    const invoice = invoiceDoc.toObject();
    const formattedInvoice = {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      invoice_date: invoice.invoice_date ? formatDateTime(invoice.invoice_date) : null,
      due_date: invoice.due_date ? formatDateTime(invoice.due_date) : null,
      transport_details: invoice.transport_details || "",
      lr_number: invoice.lr_number || "",
      customer: {
        id: invoice.customer_id?._id,
        name: invoice.customer_id?.name,
        email: invoice.customer_id?.email,
        phone: invoice.customer_id?.phone,
        address: invoice.customer_id?.address,
        state: invoice.customer_id?.state,
        pincode: invoice.customer_id?.pin_code,
        gst: invoice.customer_id?.gst_no,
      },
      sales_order: {
        id: invoice.sales_id?._id,
        sales_order_number: invoice.sales_id?.order_id,
      },
      items: invoice.items.map((item) => {
        // Use stored snapshot if available, otherwise fall back to populated data for backward compatibility
        const fgData = item.finished_good_snapshot || item.finished_good;

        return {
          sales_item: item.sales_item,
          finished_good: {
            id: item.finished_good?._id || item.finished_good,
            model: fgData?.model,
            type: fgData?.type,
            ratio: fgData?.ratio,
            power: fgData?.power,
            other_specification: fgData?.other_specification,
            gst_slab: fgData?.gst_slab ? Number(fgData.gst_slab) : 0,
          },
          description: item.description,
          invoiced_quantity: item.invoiced_quantity,
          rate_per_unit: item.rate_per_unit ? Number(item.rate_per_unit) : 0,
          invoiced_amount: item.invoiced_amount ? Number(item.invoiced_amount) : 0,
          taxes: item.taxes.map((t) => ({
            type: t.type,
            percentage: t.percentage ? Number(t.percentage) : 0,
            amount: t.amount ? Number(t.amount) : 0,
          })),
          total_with_tax: item.total_with_tax ? Number(item.total_with_tax) : 0,
        };
      }),
      total_invoice_amount: invoice.total_invoice_amount ? Number(invoice.total_invoice_amount) : 0,
      createdAt: invoice.createdAt ? formatDateTime(invoice.createdAt) : null,
    };

    res.json(formattedInvoice);
  } catch (error) {
    next(error);
  }
};

export const updateTransportDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transport_details, lr_number } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Update transport details
    if (transport_details !== undefined) {
      invoice.transport_details = transport_details;
    }
    if (lr_number !== undefined) {
      invoice.lr_number = lr_number;
    }

    // Auto-change status to PROCESSED when transport details are added
    if ((transport_details && transport_details.trim() !== "") || (lr_number && lr_number.trim() !== "")) {
      invoice.status = "PROCESSED";
    }

    logger.info(`Transport details updated for invoice: ${invoice.invoice_number}`);
    res.status(200).json({
      message: "Transport details updated successfully",
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        transport_details: invoice.transport_details,
        lr_number: invoice.lr_number,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["UNPROCESSED", "PROCESSED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Valid statuses are: UNPROCESSED, PROCESSED"
      });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check if user has permission to update this invoice
    if (req.user?.role === "CUSTOMER" && invoice.customer_id.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only update your own invoices" });
    }

    invoice.status = status;
    await invoice.save();

    logger.info(`Invoice status updated: ${invoice.invoice_number} -> ${status}`);
    res.status(200).json({
      message: "Invoice status updated successfully",
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Only ADMIN can delete invoices
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only administrators can delete invoices" });
    }

    // Check if invoice can be deleted (not processed)
    if (invoice.status === "PROCESSED") {
      return res.status(400).json({
        message: "Cannot delete processed invoices. Please contact support."
      });
    }

    // Restore stock quantities
    for (const item of invoice.items) {
      await FinishedGoods.findByIdAndUpdate(
        item.finished_good,
        { $inc: { units: item.invoiced_quantity } }, // Add back the invoiced quantity
        { new: true }
      );
    }

    // Restore production quantities
    await restoreProductionQuantitiesOnInvoiceDeletion(invoice.items);

    // Remove ledger entry
    await Ledger.deleteOne({ invoice_id: invoice._id });

    // Delete the invoice
    await Invoice.findByIdAndDelete(id);

    logger.warn(`Invoice deleted: ${invoice.invoice_number} by ${req.user.user_name}`);
    res.status(200).json({
      message: "Invoice deleted successfully and stock restored",
      deletedInvoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to update production quantities when invoicing
const updateProductionQuantitiesOnInvoicing = async (items) => {
  try {
    for (const { fg_id, quantity } of items) {
      // Find production record for this finished good
      const production = await Production.findOne({
        finished_good: fg_id
      });

      if (production) {
        // Reduce total production quantity by the invoiced amount
        // This represents that we no longer need to produce these items
        const newProductionQuantity = Math.max(0, production.production_quantity - quantity);

        production.production_quantity = newProductionQuantity;
        production.updated_at = new Date();
        logger.info(`Updated production for FG ${fg_id}: reduced production_quantity by ${quantity}`);
      }
    }
  } catch (error) {
    logger.error("Error updating production quantities on invoicing:", error);
    // Don't throw error here as invoice creation should still succeed
  }
};

// Helper function to restore production quantities when invoice is deleted
const restoreProductionQuantitiesOnInvoiceDeletion = async (items) => {
  try {
    for (const item of items) {
      // Find production record for this finished good
      const production = await Production.findOne({
        finished_good: item.finished_good
      });

      if (production) {
        // Restore production_quantity by the invoiced amount
        production.production_quantity += item.invoiced_quantity;
        production.updated_at = new Date();
        logger.info(`Restored production for FG ${item.finished_good}: increased production_quantity by ${item.invoiced_quantity}`);
      }
    }
  } catch (error) {
    logger.error("Error restoring production quantities on invoice deletion:", error);
    // Don't throw error here as invoice deletion should still succeed
  }
};

// Generate PDF invoice
export const generateInvoicePDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    const invoiceDoc = await Invoice.findById(id)
      .populate("sales_id", "sales_order_number")
      .populate("customer_id")
      .populate("items.finished_good");

    if (!invoiceDoc) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Convert to plain object
    const invoice = invoiceDoc.toObject();
    const formattedInvoice = {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      invoice_date: invoice.invoice_date ? formatDateTime(invoice.invoice_date) : null,
      due_date: invoice.due_date ? formatDateTime(invoice.due_date) : null,
      transport_details: invoice.transport_details || "",
      lr_number: invoice.lr_number || "",
      customer: {
        id: invoice.customer_id?._id,
        name: invoice.customer_id?.name,
        email: invoice.customer_id?.email,
        phone: invoice.customer_id?.phone,
        address: invoice.customer_id?.address,
        state: invoice.customer_id?.state,
        pincode: invoice.customer_id?.pin_code,
        gst: invoice.customer_id?.gst_no,
      },
      sales_order: {
        id: invoice.sales_id?._id,
        sales_order_number: invoice.sales_id?.order_id,
      },
      items: invoice.items.map((item) => {
        const fgData = item.finished_good_snapshot || item.finished_good;

        return {
          sales_item: item.sales_item,
          finished_good: {
            id: item.finished_good?._id || item.finished_good,
            model: fgData?.model,
            type: fgData?.type,
            ratio: fgData?.ratio,
            power: fgData?.power,
            other_specification: fgData?.other_specification,
            gst_slab: fgData?.gst_slab ? Number(fgData.gst_slab) : 0,
          },
          description: item.description,
          invoiced_quantity: item.invoiced_quantity,
          rate_per_unit: item.rate_per_unit ? Number(item.rate_per_unit) : 0,
          invoiced_amount: item.invoiced_amount ? Number(item.invoiced_amount) : 0,
          taxes: item.taxes.map((t) => ({
            type: t.type,
            percentage: t.percentage ? Number(t.percentage) : 0,
            amount: t.amount ? Number(t.amount) : 0,
          })),
          total_with_tax: item.total_with_tax ? Number(item.total_with_tax) : 0,
        };
      }),
      total_invoice_amount: invoice.total_invoice_amount ? Number(invoice.total_invoice_amount) : 0,
      createdAt: invoice.createdAt ? formatDateTime(invoice.createdAt) : null,
    };

    // Generate HTML for the invoice
    const htmlContent = generateInvoiceHTML(formattedInvoice);

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    await browser.close();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${formattedInvoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    next(error);
  }
};

// Helper function to generate HTML for invoice
const generateInvoiceHTML = (invoice) => {
  // Calculate subtotal (before tax)
  const subtotal = invoice.items.reduce((sum, item) => sum + item.invoiced_amount, 0);

  // Calculate tax summary (group by type)
  const taxSummary = invoice.items.reduce((acc, item) => {
    item.taxes?.forEach((t) => {
      if (!acc[t.type]) {
        acc[t.type] = { percentage: t.percentage, amount: 0 };
      }
      acc[t.type].amount += t.amount;
    });
    return acc;
  }, {});

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background: white;
            }
            
            .invoice-container {
                max-width: 4xl;
                margin: 0 auto;
                padding: 24px;
                font-size: 14px;
                color: black;
                background: white;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }
            
            .logo {
                width: 96px;
                height: auto;
            }
            
            .invoice-info {
                text-align: right;
            }
            
            .invoice-info h2 {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            
            .invoice-info p {
                margin-bottom: 4px;
            }
            
            .company-details {
                margin-bottom: 24px;
            }
            
            .company-details p {
                margin-bottom: 4px;
            }
            
            .customer-section {
                margin-bottom: 24px;
            }
            
            .customer-section h3 {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .customer-section p {
                margin-bottom: 4px;
            }
            
            .sales-order-section {
                margin-bottom: 24px;
            }
            
            .sales-order-section h3 {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .sales-order-section p {
                margin-bottom: 4px;
            }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #d1d5db;
                margin-bottom: 24px;
            }
            
            .items-table th {
                background-color: #f3f4f6;
                border: 1px solid #d1d5db;
                padding: 8px;
                text-align: left;
                font-weight: 500;
            }
            
            .items-table td {
                border: 1px solid #d1d5db;
                padding: 8px;
                text-align: left;
            }
            
            .items-table tr:nth-child(even) {
                background-color: #f9fafb;
            }
            
            .items-table ul {
                margin: 0;
                padding-left: 16px;
            }
            
            .items-table li {
                margin-bottom: 2px;
            }
            
            .total-section {
                text-align: right;
                margin-top: 16px;
            }
            
            .total-section p {
                margin-bottom: 4px;
            }
            
            .grand-total {
                font-weight: 600;
                font-size: 18px;
                margin-top: 8px;
            }
            
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #d1d5db;
                text-align: center;
                color: #6b7280;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="logo">
                    <!-- Logo placeholder - you can add actual logo here -->
                    <img src="https://customer.magneqtransmission.com/server/api/assets/black-logo.png" alt="Company Logo" class="logo" />

                </div>
                <div class="invoice-info">
                    <h2>INVOICE</h2>
                    <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
                    <p><strong>Status:</strong> ${invoice.status}</p>
                    <p><strong>Date:</strong> ${invoice.invoice_date}</p>
                    ${invoice.due_date ? `<p><strong>Due Date:</strong> ${invoice.due_date}</p>` : ''}
                </div>
            </div>

            <!-- Company Details -->
            <div class="company-details">
                <p><strong>Company Name:</strong> MAGNEQ TRANSMISSION PRIVATE LIMITED</p>
                <p><strong>Address:</strong> PLOT NO.E-24/6, MIDC INDL.AREA,CHIKALTHANA, Chh. SAMBHAJINAGAR</p>
                <p><strong>Phone:</strong> +91 98765 43210</p>
                <p><strong>GSTIN:</strong> 27AABCU9603R1ZV</p>
            </div>

            <!-- Customer Info -->
            <div class="customer-section">
                <h3>Bill To:</h3>
                <p><strong>Name:</strong> ${invoice.customer?.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${invoice.customer?.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${invoice.customer?.phone || 'N/A'}</p>
                <p><strong>Address:</strong> ${invoice.customer?.address || 'N/A'}</p>
                <p><strong>State:</strong> ${invoice.customer?.state || 'N/A'}</p>
                <p><strong>Pincode:</strong> ${invoice.customer?.pincode || 'N/A'}</p>
                <p><strong>GSTIN:</strong> ${invoice.customer?.gst || 'N/A'}</p>
            </div>

            <!-- Sales Order Info -->
            ${invoice.sales_order?.sales_order_number ? `
                <div class="sales-order-section">
                    <h3>Sales Order:</h3>
                    <p><strong>Order #:</strong> ${invoice.sales_order.sales_order_number}</p>
                </div>
            ` : ''}

            <!-- Item Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Sr.</th>
                        <th>Product</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Taxes</th>
                        <th>Total w/ Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map((item, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>
                                ${getFgModelNumber(item.finished_good) || 'N/A'}
                            </td>
                            <td>${item.description || '-'}</td>
                            <td>${item.invoiced_quantity}</td>
                            <td>₹${item.rate_per_unit.toFixed(2)}</td>
                            <td>₹${item.invoiced_amount.toFixed(2)}</td>
                            <td>
                                ${item.taxes?.length ? `
                                    <ul>
                                        ${item.taxes.map((t, i) => `
                                            <li>${t.type} (${t.percentage}%): ₹${t.amount.toFixed(2)}</li>
                                        `).join('')}
                                    </ul>
                                ` : '—'}
                            </td>
                            <td>₹${item.total_with_tax.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Subtotal + Tax Summary + Grand Total -->
            <div class="total-section">
                <p><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</p>

                ${Object.entries(taxSummary).map(([type, { percentage, amount }], idx) => `
                    <p><strong>${type} (${percentage}%):</strong> ₹${amount.toFixed(2)}</p>
                `).join('')}

                <p class="grand-total">
                    Grand Total: ₹${invoice.total_invoice_amount.toFixed(2)}
                </p>
            </div>

            <!-- Transport Details -->
            ${invoice.transport_details || invoice.lr_number ? `
                <div class="customer-section">
                    <h3>Transport Details:</h3>
                    ${invoice.lr_number ? `<p><strong>LR Number:</strong> ${invoice.lr_number}</p>` : ''}
                    ${invoice.transport_details ? `<p><strong>Details:</strong> ${invoice.transport_details}</p>` : ''}
                </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>Generated on: ${invoice.createdAt}</p>
            </div>
        </div>
    </body>
    </html>
  `;
};