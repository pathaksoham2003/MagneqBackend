import ExcelJS from "exceljs";
import PaymentRecieval from "../models/PaymentRecieval.js";
import Customer from "../models/Customers.js";
import Ledger from "../models/Ledger.js";
import Invoice from "../models/Invoice.js";
import logger from "../utils/logger.js";

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
 * Handles both array of objects (key-value pairs) and array of arrays (structured rows)
 */
const sendExcelFile = async (res, data, filename, worksheetName) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);

  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Check if data is array of arrays (structured format) or array of objects
  const isStructuredFormat = Array.isArray(data[0]) && !Array.isArray(data[0][0]);

  if (isStructuredFormat) {
    // Handle structured format (array of arrays) - like ledger/receipt exports
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Style header rows (company name, etc.)
    // Find the table header row (usually contains "Date", "Particulars", etc.)
    let tableHeaderRowIndex = -1;
    let subHeaderRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (Array.isArray(data[i]) && data[i].length > 0) {
        const firstCell = String(data[i][0]).toLowerCase();
        if (firstCell === "date" || firstCell.includes("date")) {
          tableHeaderRowIndex = i + 1; // Excel rows are 1-indexed
          // Check if next row is a sub-header (contains "Amount" or "KGS")
          if (i + 1 < data.length && Array.isArray(data[i + 1])) {
            const nextRow = data[i + 1];
            const hasAmount = nextRow.length > 4 && String(nextRow[4]).toLowerCase() === "amount";
            const hasKGS = nextRow.length > 3 && String(nextRow[3]).toLowerCase() === "kgs";
            if (hasAmount || hasKGS) {
              subHeaderRowIndex = i + 2; // Excel rows are 1-indexed
            }
          }
          break;
        }
      }
    }

    // Style company header row (usually first row) - merge across all columns
    if (data[0] && data[0].length > 0) {
      const firstRow = worksheet.getRow(1);
      firstRow.font = { bold: true, size: 14 };
      firstRow.alignment = { horizontal: "left", vertical: "middle" };
      const maxCols = Math.max(...data.map(row => Array.isArray(row) ? row.length : 0), 6);
      worksheet.mergeCells(1, 1, 1, maxCols);
    }

    // Style "Receipt Register" or "Sales Register" title row if it exists (usually row 4) - merge only 3 columns
    if (data.length >= 4 && Array.isArray(data[3]) && data[3][0] && 
        (String(data[3][0]).toLowerCase().includes("receipt register") ||
         String(data[3][0]).toLowerCase().includes("sales register"))) {
      const titleRow = worksheet.getRow(4);
      titleRow.font = { bold: true, size: 12 };
      titleRow.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.mergeCells(4, 1, 4, 3);
    }

    // Style date range row if it exists (usually row 5) - merge only 3 columns
    if (data.length >= 5 && Array.isArray(data[4]) && data[4][0] && 
        (String(data[4][0]).toLowerCase().includes("to") || 
         String(data[4][0]).toLowerCase().includes("onwards") ||
         String(data[4][0]).toLowerCase().includes("up to") ||
         String(data[4][0]).toLowerCase().includes("all payments") ||
         String(data[4][0]).toLowerCase().includes("all invoices"))) {
      const dateRow = worksheet.getRow(5);
      dateRow.alignment = { horizontal: "left", vertical: "middle" };
      worksheet.mergeCells(5, 1, 5, 3);
    }

    // Style table header row if found
    if (tableHeaderRowIndex > 0) {
      const headerRow = worksheet.getRow(tableHeaderRowIndex);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }

    // Style sub-header row if found (for "Amount" labels)
    if (subHeaderRowIndex > 0) {
      const subHeaderRow = worksheet.getRow(subHeaderRowIndex);
      subHeaderRow.font = { bold: true, italic: true };
      subHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      };
    }

    // Style total row (last row) - check for "Total" or "Grand Total"
    const lastRowIndex = data.length;
    if (lastRowIndex > 0) {
      const lastRow = worksheet.getRow(lastRowIndex);
      const firstCell = lastRow.getCell(1).value;
      const secondCell = lastRow.getCell(2).value;
      if ((firstCell && String(firstCell).toLowerCase().includes("total")) ||
          (secondCell && String(secondCell).toLowerCase().includes("grand total"))) {
        lastRow.font = { bold: true };
        lastRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8E8E8" },
        };
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column) {
        column.width = 20;
      }
    });
  } else {
    // Handle object format (array of objects) - like invoice exports
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
  }

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

/**
 * 🔹 Export Invoices (Sales Register format)
 * Creates a structured sales register export matching the Excel format
 */
const exportInvoices = async (customerId, customer, startDate, endDate) => {
  logger.info(`Exporting invoices (sales register format) for ${customer.name}...`);

  // Inclusive date filter
  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.invoice_date = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  } else if (startDate) {
    dateFilter.invoice_date = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
    };
  } else if (endDate) {
    dateFilter.invoice_date = {
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  }

  // Fetch invoices within range
  const invoices = await Invoice.find({
    customer_id: customerId,
    ...dateFilter,
  })
    .populate("customer_id", "name gst_no address state")
    .sort({ invoice_date: 1 })
    .lean();

  if (!invoices.length) {
    throw new Error("No invoices found in selected date range");
  }

  // 🧾 Build structured export data matching Sales Register format
  const formattedData = [];

  // Row 1: Company name
  formattedData.push(["MAGNEQ TRANSMISSION PRIVATE LIMITED"]);

  // Row 2: Address line 1
  formattedData.push(["PLOT NO.E-24/6, MIDC INDL.AREA,"]);

  // Row 3: Address line 2
  formattedData.push(["CHIKALTHANA, AURANGABAD"]);

  // Row 4: Sales Register title
  formattedData.push(["Sales Register"]);

  // Row 5: Date range
  if (startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    formattedData.push([`${formatReceiptDate(start)} to ${formatReceiptDate(end)}`]);
  } else if (startDate) {
    formattedData.push([`${formatReceiptDate(new Date(`${startDate}T00:00:00.000Z`))} onwards`]);
  } else if (endDate) {
    formattedData.push([`up to ${formatReceiptDate(new Date(`${endDate}T23:59:59.999Z`))}`]);
  } else {
    formattedData.push(["All Invoices"]);
  }

  // Row 6: Main header row
  formattedData.push([
    "Date",
    "Particulars",
    "Voucher Type",
    "Kgs",
    "Voucher No.",
    "Voucher Ref. No.",
    "Quantity",
    "Value",
    "Gross Total",
    "SALES SCRAP",
    "OUTPUT CGST 9%",
    "OUTPUT SGST 9%",
    "ROUND OFF",
    "SALES IGST 18%",
    "OUTPUT IGST 18%",
    "SALES GST"
  ]);

  // Row 7: Sub-header row (some columns have sub-headers)
  formattedData.push([
    "",
    "",
    "",
    "KGS",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  // 🧾 Invoice Entries - one row per invoice
  let grandTotalQuantity = 0;
  let grandTotalValue = 0;
  let grandTotalGross = 0;
  let grandTotalScrap = 0;
  let grandTotalCGST = 0;
  let grandTotalSGST = 0;
  let grandTotalRoundOff = 0;
  let grandTotalIGST = 0;
  let grandTotalOutputIGST = 0;
  let grandTotalGST = 0;

  invoices.forEach((inv) => {
    // Check if interstate (different state)
    const customerState = inv.customer_id?.state || "";
    const companyState = "Maharashtra"; // Company is in Maharashtra
    const isInterState = customerState && customerState.toLowerCase() !== "maharashtra";

    // Aggregate invoice data from invoice items
    let totalQuantity = 0;
    let totalValue = 0; // Base amount before tax (sum of invoiced_amount)
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalOutputIGST = 0;
    let totalGST = 0;

    // Use invoice's total_invoice_amount as the gross total (includes all taxes)
    const totalGross = formatDecimal(inv.total_invoice_amount);

    if (inv.items && inv.items.length > 0) {
      inv.items.forEach((item) => {
        const quantity = item.invoiced_quantity || 0;
        const baseAmount = formatDecimal(item.invoiced_amount);
        
        totalQuantity += quantity;
        totalValue += baseAmount;

        // Get tax details from invoice item taxes array
        if (item.taxes && item.taxes.length > 0) {
          item.taxes.forEach((tax) => {
            const taxAmount = formatDecimal(tax.amount);
            if (tax.type === "CGST") {
              totalCGST += taxAmount;
            } else if (tax.type === "SGST") {
              totalSGST += taxAmount;
            } else if (tax.type === "IGST") {
              totalIGST += taxAmount;
              totalOutputIGST += taxAmount;
            }
          });
        }
      });
    } else {
      // Handle invoices without items - use invoice total as value
      totalValue = totalGross;
    }

    // Calculate total GST (sum of all tax types)
    totalGST = totalCGST + totalSGST + totalIGST;

    // Calculate round off (difference between invoice gross total and calculated value + GST)
    const calculatedTotal = totalValue + totalGST;
    const roundOff = totalGross - calculatedTotal;

    // Format invoice number (e.g., "25-26/370")
    const invoiceYear = new Date(inv.invoice_date).getFullYear();
    const shortYear = invoiceYear % 100;
    const nextYear = shortYear + 1;
    const voucherNo = `${shortYear}-${nextYear}/${inv.invoice_number}`;

    formattedData.push([
      formatReceiptDate(inv.invoice_date),
      inv.customer_id?.name || "N/A",
      "Sales",
      "", // Kgs - empty for now
      voucherNo,
      inv.lr_number || "", // Voucher Ref. No. - using LR number
      totalQuantity > 0 ? `${totalQuantity.toFixed(0)} NOS` : "",
      totalValue.toFixed(2),
      `${totalGross.toFixed(2)} Dr`,
      "", // SALES SCRAP - empty for now
      totalCGST > 0 ? `${totalCGST.toFixed(2)} Cr` : "",
      totalSGST > 0 ? `${totalSGST.toFixed(2)} Cr` : "",
      roundOff !== 0 ? `${Math.abs(roundOff).toFixed(2)} ${roundOff > 0 ? "Cr" : "Dr"}` : "",
      totalIGST > 0 ? `${totalIGST.toFixed(2)} Cr` : "",
      totalOutputIGST > 0 ? `${totalOutputIGST.toFixed(2)} Cr` : "",
      totalGST > 0 ? `${totalGST.toFixed(2)} Cr` : "",
    ]);

    // Add to grand totals
    grandTotalQuantity += totalQuantity;
    grandTotalValue += totalValue;
    grandTotalGross += totalGross;
    grandTotalCGST += totalCGST;
    grandTotalSGST += totalSGST;
    grandTotalRoundOff += roundOff;
    grandTotalIGST += totalIGST;
    grandTotalOutputIGST += totalOutputIGST;
    grandTotalGST += totalGST;
  });

  // 🧾 Grand Total Row
  formattedData.push([
    "",
    "Grand Total",
    "",
    "",
    "",
    "",
    grandTotalQuantity > 0 ? grandTotalQuantity.toFixed(0) : "",
    grandTotalValue.toFixed(2),
    `${grandTotalGross.toFixed(2)} Dr`,
    grandTotalScrap > 0 ? `${grandTotalScrap.toFixed(2)} Cr` : "",
    grandTotalCGST > 0 ? `${grandTotalCGST.toFixed(2)} Cr` : "",
    grandTotalSGST > 0 ? `${grandTotalSGST.toFixed(2)} Cr` : "",
    grandTotalRoundOff !== 0 ? `${Math.abs(grandTotalRoundOff).toFixed(2)} ${grandTotalRoundOff > 0 ? "Cr" : "Dr"}` : "",
    grandTotalIGST > 0 ? `${grandTotalIGST.toFixed(2)} Cr` : "",
    grandTotalOutputIGST > 0 ? `${grandTotalOutputIGST.toFixed(2)} Cr` : "",
    grandTotalGST > 0 ? `${grandTotalGST.toFixed(2)} Cr` : "",
  ]);

  return formattedData;
};


/**
 * 🔹 Format date → DD-MMM-YYYY (e.g., "02-Nov-2025")
 */
const formatReceiptDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * 🔹 Export Payments (Receipt Register format)
 * Creates a structured receipt register export matching the CSV format
 */
const exportPayments = async (customerId, customer, startDate, endDate) => {
  logger.info(`Exporting payments (receipt register format) for ${customer.name}...`);

  // 🗓️ Make date range inclusive
  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.date_of_recieval = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  } else if (startDate) {
    dateFilter.date_of_recieval = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
    };
  } else if (endDate) {
    dateFilter.date_of_recieval = {
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  }

  // 📅 Fetch payments within the date range for the specific customer
  const payments = await PaymentRecieval.find({
    customer: customerId,
    ...dateFilter,
  })
    .populate("customer", "name gst_no address")
    .sort({ date_of_recieval: 1, createdAt: 1 })
    .lean();

  if (!payments.length) {
    throw new Error("No payments found in selected date range");
  }

  // 🧾 Build structured export data matching CSV format
  const formattedData = [];

  // Row 1: Company name
  formattedData.push(["MAGNEQ TRANSMISSION PRIVATE LIMITED"]);

  // Row 2: Address line 1
  formattedData.push(["PLOT NO.E-24/6, MIDC INDL.AREA,"]);

  // Row 3: Address line 2
  formattedData.push(["CHIKALTHANA, AURANGABAD"]);

  // Row 4: Receipt Register title
  formattedData.push(["Receipt Register"]);

  // Row 5: Date range
  if (startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    formattedData.push([`${formatReceiptDate(start)} to ${formatReceiptDate(end)}`]);
  } else if (startDate) {
    formattedData.push([`${formatReceiptDate(new Date(`${startDate}T00:00:00.000Z`))} onwards`]);
  } else if (endDate) {
    formattedData.push([`up to ${formatReceiptDate(new Date(`${endDate}T23:59:59.999Z`))}`]);
  } else {
    formattedData.push(["All Payments"]);
  }

  // Row 6: Main header row
  formattedData.push([
    "Date",
    "Particulars",
    "Vch Type",
    "Vch No.",
    "Debit",
    "Credit"
  ]);

  // Row 7: Sub-header row for Amount columns
  formattedData.push([
    "",
    "",
    "",
    "",
    "Amount",
    "Amount"
  ]);

  // 🧾 Payment Entries
  let totalAmount = 0;
  payments.forEach((payment) => {
    const amount = formatDecimal(payment.amount);
    totalAmount += amount;

    formattedData.push([
      formatReceiptDate(payment.date_of_recieval),
      payment.customer?.name || "N/A",
      "Receipt",
      payment.transactionId || "", // Using transactionId as voucher number
      "", // Debit column always empty
      amount.toFixed(2), // Credit column with amount
    ]);
  });

  // 🧾 Total Row
  formattedData.push([
    "Total:",
    "",
    "",
    "",
    "",
    totalAmount.toFixed(2),
  ]);

  return formattedData;
};

/**
 * 🔹 Export Ledger (Excel-ready structure)
 * Includes: Date Range → Customer Details → Ledger Entries → Opening/Closing Balance
 */
export const exportLedger = async (customerId, customer, startDate, endDate) => {
  logger.info(`Exporting ledger for ${customer.name} from ${startDate} to ${endDate}`);

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

export const createExport = async (req, res, next) => {
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

    logger.info(`Export completed successfully: ${exportType} for ${customer.name}`);
  } catch (error) {
    next(error);
  }
};