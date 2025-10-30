import ExcelJS from "exceljs";
import PaymentRecieval from "../models/PaymentRecieval.js";
import Customer from "../models/Customers.js";
import Ledger from "../models/Ledger.js";
import Invoice from "../models/Invoice.js";

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Formats Decimal128 values to regular numbers
 */
const formatDecimal = (value) => {
  if (!value) return 0;
  return typeof value === "object" && value.toString
    ? parseFloat(value.toString())
    : value;
};

/**
 * Formats date to readable string
 */
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN");
};

/**
 * Creates Excel workbook and sends response
 */
const sendExcelFile = async (res, data, filename, worksheetName) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);

  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Set columns from first row keys
  const firstRow = data[0];
  worksheet.columns = Object.keys(firstRow).map((key) => ({
    header: key.toUpperCase().replace(/_/g, " "),
    key: key,
    width: 20,
  }));

  // Add data rows
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Set response headers
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Length", buffer.length);

  // Send buffer
  res.send(buffer);
};

// ========================================
// EXPORT TYPE HANDLERS
// ========================================

const exportInvoices = async (customerId, customer, startDate, endDate) => {
  console.log("📋 Exporting invoices (with inclusive date filter)...");

  // Inclusive date filter
  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.invoice_date = {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)), // include full end day
    };
  } else if (startDate) {
    dateFilter.invoice_date = { $gte: new Date(startDate) };
  } else if (endDate) {
    dateFilter.invoice_date = {
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    };
  }

  // Fetch invoices within range
  const invoices = await Invoice.find({
    customer_id: customerId,
    ...dateFilter,
  })
    .populate("customer_id", "name gst_no address")
    .sort({ invoice_date: 1 })
    .lean();

  if (!invoices.length) {
    throw new Error("No invoices found in selected date range");
  }

  const formattedData = [];

  invoices.forEach((inv) => {
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach((item, idx) => {
        // Generate 3-digit item code (001–999)
        const itemCode = String(idx + 1).padStart(3, "0");

        formattedData.push({
          invoice_number: inv.invoice_number,
          invoice_date: formatDate(inv.invoice_date),
          due_date: formatDate(inv.due_date),
          customer_name: inv.customer_id?.name || "",
          customer_gst: inv.customer_id?.gst_no || "",
          status: inv.status,
          transport_details: inv.transport_details || "",
          lr_number: inv.lr_number || "",
          total_amount: formatDecimal(inv.total_invoice_amount),

          // Item-level fields (stay on same row)
          item_code: itemCode,
          item_description:
            item.description ||
            `${item.finished_good_snapshot?.model || ""} ${item.finished_good_snapshot?.type || ""} ${item.finished_good_snapshot?.ratio || ""} ${item.finished_good_snapshot?.power || ""}`.trim(),
          quantity: item.invoiced_quantity,
          rate: formatDecimal(item.rate_per_unit),
          amount: formatDecimal(item.invoiced_amount),
        });
      });
    } else {
      // Handle invoices without items
      formattedData.push({
        invoice_number: inv.invoice_number,
        invoice_date: formatDate(inv.invoice_date),
        due_date: formatDate(inv.due_date),
        customer_name: inv.customer_id?.name || "",
        customer_gst: inv.customer_id?.gst_no || "",
        status: inv.status,
        transport_details: inv.transport_details || "",
        lr_number: inv.lr_number || "",
        total_amount: formatDecimal(inv.total_invoice_amount),

        item_code: "",
        item_description: "",
        quantity: "",
        rate: "",
        amount: "",
      });
    }
  });

  return formattedData;
};


/**
 * Export Payments
 * TODO: Specify which fields to include in export
 */
const exportPayments = async (customerId, customer,startDate,endDate) => {
  console.log("💰 Exporting payments...");

  const payments = await PaymentRecieval.find({ customer: customerId })
    .populate("customer", "name gst_no")
    .lean();

  if (!payments.length) {
    throw new Error("No payments found");
  }

  // TODO: Map payment data to desired fields
  // Example format - modify as needed:
  const formattedData = payments.map((payment) => ({
    date: formatDate(payment.date_of_recieval),
    customer_name: payment.customer?.name || "",
    amount: formatDecimal(payment.amount),
    transaction_type: payment.transactionType,
    transaction_id: payment.transactionId,
    description: payment.description || "",
    // Add more fields as needed
  }));

  return formattedData;
};

/**
 * 🔹 Export Ledger (Excel-ready structure)
 * Includes: Date Range → Customer Details → Ledger Entries → Opening/Closing Balance
 */
export const exportLedger = async (customerId, customer, startDate, endDate) => {
  console.log("📒 Exporting ledger from", startDate, "to", endDate);

  // 🗓️ Make date range inclusive
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  // 🧾 1️⃣ Get customer info (if not passed)
  const customerInfo =
    customer ||
    (await Customer.findById(customerId)
      .select("name address gst_number")
      .lean());

  if (!customerInfo) {
    throw new Error("Customer not found");
  }

  // 🧮 2️⃣ Get opening balance (latest entry before start date)
  const previousEntry = await Ledger.findOne({
    customer_id: customerId,
    date: { $lt: start },
  })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const openingBalance = previousEntry
    ? parseFloat(previousEntry.running_balance)
    : 0;

  // 📅 3️⃣ Fetch ledger entries within the date range
  const entries = await Ledger.find({
    customer_id: customerId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  if (!entries.length && openingBalance === 0) {
    throw new Error("No ledger entries found for the selected date range");
  }

  // 🧾 4️⃣ Build structured export data
  let runningBalance = openingBalance;
  const formattedData = [];

  // 🧷 Header section (Date range first)
  formattedData.push([
    "Date Range",
    `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`,
  ]);

  // 🧷 Customer details (each key/value in separate cells)
  formattedData.push(["Customer Name", customerInfo.name || "N/A"]);
  formattedData.push(["Customer GST", customerInfo.gst_number || "N/A"]);
  formattedData.push(["Customer Address", customerInfo.address || "N/A"]);

  // Blank spacer row
  formattedData.push([]);

  // 🧾 Table Header Row
  formattedData.push([
    "Date",
    "Particulars",
    "Voucher Type",
    "Debit",
    "Credit",
    "Balance",
  ]);

  // 🧾 Opening Balance Row
  formattedData.push([
    formatDisplayDate(start),
    "Opening Balance",
    "",
    openingBalance > 0 ? openingBalance.toFixed(2) : "",
    openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : "",
    openingBalance.toFixed(2),
  ]);

  // 🧾 Ledger Entries
  for (const e of entries) {
    const debit = e.type === "DEBIT" ? parseFloat(e.amount) : 0;
    const credit = e.type === "CREDIT" ? parseFloat(e.amount) : 0;
    runningBalance += debit - credit;

    formattedData.push([
      formatDisplayDate(e.date),
      e.details || "",
      e.type === "DEBIT" ? "Sales" : "Receipt",
      debit ? debit.toFixed(2) : "",
      credit ? credit.toFixed(2) : "",
      runningBalance.toFixed(2),
    ]);
  }

  // 🧾 Closing Balance Row
  formattedData.push([
    formatDisplayDate(end),
    "Closing Balance",
    "",
    runningBalance > 0 ? runningBalance.toFixed(2) : "",
    runningBalance < 0 ? Math.abs(runningBalance).toFixed(2) : "",
    runningBalance.toFixed(2),
  ]);

  return formattedData;
};

/**
 * 🔹 Utility: Format date → dd-MM-yyyy
 */
function formatDisplayDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}


// ========================================
// MAIN EXPORT CONTROLLER
// ========================================

export const createExport = async (req, res) => {
  try {
    console.log("🟢 [EXPORT] Request received:", req.body);

    const { customerId, exportType, startDate, endDate } = req.body;

    // Validation
    if (!customerId || !exportType) {
      console.warn("⚠️ Missing required fields:", { customerId, exportType });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Fetch customer
    console.log("🔍 Fetching customer:", customerId);
    const customer = await Customer.findById(customerId);
    if (!customer) {
      console.warn("❌ Customer not found for ID:", customerId);
      return res.status(404).json({ message: "Customer not found" });
    }

    console.log(`📦 Export Type: ${exportType} for customer: ${customer.name}`);

    // Route to appropriate export handler
    let data;
    let filename;
    let worksheetName;

    switch (exportType) {
      case "invoices":
        data = await exportInvoices(customerId, customer,startDate,endDate);
        filename = `Invoices_${customer.name}_${Date.now()}.xlsx`;
        worksheetName = "INVOICES";
        break;

      case "payments":
        data = await exportPayments(customerId, customer,startDate,endDate);
        filename = `Payments_${customer.name}_${Date.now()}.xlsx`;
        worksheetName = "PAYMENTS";
        break;

      case "ledger":
        data = await exportLedger(customerId, customer,startDate,endDate);
        filename = `Ledger_${customer.name}_${Date.now()}.xlsx`;
        worksheetName = "LEDGER";
        break;

      default:
        console.warn("⚠️ Invalid exportType provided:", exportType);
        return res.status(400).json({ message: "Invalid export type" });
    }

    console.log(`📊 Records found: ${data.length}`);

    // Generate and send Excel file
    await sendExcelFile(res, data, filename, worksheetName);

    console.log("✅ Export completed successfully for:", customer.name);
  } catch (error) {
    console.error("❌ EXPORT ERROR:", error);
    res.status(500).json({
      message: "Export failed",
      error: error.message,
    });
  }
};