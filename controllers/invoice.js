import Invoice from "../models/Invoice.js";
import Sales from "../models/Sales.js";
import FinishedGoods from "../models/FinishedGoods.js";
import { calculateTaxes } from "../utils/taxCalculator.js";

export const createInvoice = async (req, res) => {
  try {
    const { sales_id, customer_id, items, delivery_date, isInterState } = req.body;

    const sales = await Sales.findById(sales_id);
    if (!sales) return res.status(404).json({ message: "Sales order not found" });

    let totalInvoiceAmount = 0;
    let processedItems = [];

    for (const item of items) {
      const { sales_item, invoiced_quantity, invoiced_amount } = item;

      const taxes = await calculateTaxes(item.finished_good, parseFloat(invoiced_amount), isInterState);
      const taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0);

      totalInvoiceAmount += parseFloat(invoiced_amount) + taxTotal;

      processedItems.push({
        sales_item,
        invoiced_quantity,
        invoiced_amount,
        taxes,
      });
    }

    // Calculate due_date = delivery_date + 45 days
    let dueDate = null;
    if (delivery_date) {
      dueDate = new Date(delivery_date);
      dueDate.setDate(dueDate.getDate() + 45);
    }

    const invoice = await Invoice.create({
      sales_id,
      customer_id,
      items: processedItems,
      delivery_date,
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
    const invoices = await Invoice.find()
      .populate("sales_id")
      .populate("customer_id");
    return res.status(200).json(invoices);
  } catch (err) {
    console.error("Error fetching invoices:", err);
    return res.status(500).json({ message: "Internal Server Error" });
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
