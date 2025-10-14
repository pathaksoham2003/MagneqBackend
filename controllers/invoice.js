import Invoice from "../models/Invoice.js";
import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import { calculateTaxes } from "../utils/taxCalculator.js";
import Customers from "../models/Customers.js";
import { formatDateTime, getFgModelNumber } from "../utils/helper.js";
import Ledger from "../models/Ledger.js";
import { PAYMENT_TERMS } from "../constants/paymentTerms.js";

export const createInvoice = async (req, res) => {
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
        finished_good: fg._id,
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
      await FinishedGoods.findByIdAndUpdate(
        fg_id,
        { $inc: { units: -quantity } }, // Reduce stock by invoiced quantity
        { new: true }
      );
    }

    // 7. Create ledger entry for the invoice (Debit)
    const ledgerEntry = await Ledger.create({
      customer_id: customer_id,
      invoice_id: invoice._id,
      date: new Date(),
      type: "DEBIT", // invoice = debit
      amount: totalInvoiceAmount,
      details: `Invoice #${invoice.invoice_number} created`,
    });

    // 8. 🔹 Check if ALL items are fully invoiced
    const allInvoiced = sales.finished_goods.every(
      (item) => item.invoiced_quantity >= item.quantity
    );

    if (allInvoiced) {
      sales.status = "PROCESSED";
      await sales.save();
    }

    return res.status(201).json({
      message: "Invoice created, stock updated & ledger updated",
      invoice,
      ledgerEntry,
    });
  } catch (err) {
    console.error("Error creating invoice:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllInvoices = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchQuery = req.query.search;
    const customerId = req.query.customer_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    // Build base query
    let query = {};

    // Filter by customer ID if provided
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
      })
      .populate({
        path: "customer_id",
        select: "name user_name state gst_no",
      });

    const items = invoices.map((inv) => {
      const invoiceDetails = inv.items.map((it) => {
        const fgData = inv.sales_id?.finished_goods.find(
          (fg) => fg.finished_good?._id.toString() === it.finished_good?.toString()
        )?.finished_good;
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
    res.status(500).json({ error: err.message });
  }
};

export const getInvoicesBySalesId = async (req, res) => {
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
    console.error("Error fetching invoices by Sales ID:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getInvoicesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

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
      id:inv._id,
      invoice_number: inv.invoice_number,
      sales_order_number: inv.sales_id ? `SO-${inv.sales_id.order_id}` : null,
      invoice_date: inv.invoice_date,
    }));

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInvoiceById = async (req, res) => { 
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
        gst:invoice.customer_id?.gst_no,
      },
      sales_order: {
        id: invoice.sales_id?._id,
        sales_order_number: invoice.sales_id?.order_id,
      },
      items: invoice.items.map((item) => ({
        sales_item: item.sales_item,
        finished_good: {
          id: item.finished_good?._id,
          model: item.finished_good?.model,
          type: item.finished_good?.type,
          ratio: item.finished_good?.ratio,
          power: item.finished_good?.power,
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
      })),
      total_invoice_amount: invoice.total_invoice_amount ? Number(invoice.total_invoice_amount) : 0,
      createdAt: invoice.createdAt ? formatDateTime(invoice.createdAt) : null,
    };

    res.json(formattedInvoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateTransportDetails = async (req, res) => {
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

    await invoice.save();

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
    console.error("Error updating transport details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["DISPATCHED", "DELIVERED", "OUT_FOR_DELIVERY"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Valid statuses are: DISPATCHED, DELIVERED, OUT_FOR_DELIVERY" 
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

    res.status(200).json({
      message: "Invoice status updated successfully",
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
      },
    });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteInvoice = async (req, res) => {
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

    // Check if invoice can be deleted (not delivered)
    if (invoice.status === "DELIVERED") {
      return res.status(400).json({ 
        message: "Cannot delete delivered invoices. Please contact support." 
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

    // Remove ledger entry
    await Ledger.deleteOne({ invoice_id: invoice._id });

    // Delete the invoice
    await Invoice.findByIdAndDelete(id);

    res.status(200).json({
      message: "Invoice deleted successfully and stock restored",
      deletedInvoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
      },
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};