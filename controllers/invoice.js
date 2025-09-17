import Invoice from "../models/Invoice.js";
import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import { calculateTaxes } from "../utils/taxCalculator.js";
import Customers from "../models/Customers.js";
import { getFgModelNumber } from "../utils/helper.js";

export const createInvoice = async (req, res) => {
  try {
    const { sales_id, customer_id, items } = req.body;

    // 1. Fetch Sales & Customer
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

      // base values
      const rate = parseFloat(fg.rate_per_unit.toString());
      const gstRate = parseFloat(fg.gst_slab.toString());
      const amount = rate * quantity;

      let taxEntries = [];
      let totalWithTax = amount;

      if (isInterState) {
        // IGST only
        const taxAmount = (amount * gstRate) / 100;
        taxEntries.push({
          type: "IGST",
          percentage: gstRate,
          amount: taxAmount,
        });
        totalWithTax += taxAmount;
      } else {
        // CGST + SGST (split equally)
        const halfRate = gstRate / 2;
        const halfAmount = (amount * halfRate) / 100;
        taxEntries.push({
          type: "CGST",
          percentage: halfRate,
          amount: halfAmount,
        });
        taxEntries.push({
          type: "SGST",
          percentage: halfRate,
          amount: halfAmount,
        });
        totalWithTax += halfAmount * 2;
      }

      totalInvoiceAmount += totalWithTax;

      processedItems.push({
        sales_item: fg_id, // refer to FG inside sales
        finished_good: fg._id,
        description: `${fg.model} ${fg.type} ${fg.ratio} ${fg.power}`,
        invoiced_quantity: quantity,
        rate_per_unit: rate,
        invoiced_amount: amount,
        taxes: taxEntries,
        total_with_tax: totalWithTax,
      });
    }

    // 3. Calculate due_date = delivery_date + 45 days
    let dueDate = null;
    if (sales.delivery_date) {
      dueDate = new Date(sales.delivery_date);
      dueDate.setDate(dueDate.getDate() + 45);
    }

    // 4. Create Invoice
    const invoice = await Invoice.create({
      sales_id,
      customer_id,
      items: processedItems,
      due_date: dueDate,
      total_invoice_amount: totalInvoiceAmount,
    });

    return res.status(201).json(invoice);
  } catch (err) {
    console.error("Error creating invoice:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllInvoices = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.page_no) || 1;
    const PAGE_SIZE = 10;
    const searchInvoice = req.query.search ? parseInt(req.query.search) : null;

    const query = searchInvoice ? { invoice_number: searchInvoice } : {};

    if (req.user?.role === "CUSTOMER") {
      query.customer_id = req.user.id; // only their invoices
    } else if (req.user?.role === "SALES") {
      // later can add filter on created_by if needed
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
