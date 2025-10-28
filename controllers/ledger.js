import puppeteer from "puppeteer";
import { format } from "date-fns";
import Ledger from "../models/Ledger.js";
import Customer from "../models/Customers.js";
import { generateLedgerHTML } from "../utils/ledgerTemplate.js";
import { getLastRunningBalance } from "../utils/ledgerUtils.js";

/**
 * 🔹 Common Ledger Logic (used by both API & PDF)
 */
export const getLedgerData = async (customerId, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1️⃣ Get opening balance before start date
  const previousEntry = await Ledger.findOne({
    customer_id: customerId,
    date: { $lt: start },
  })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const openingBalance = previousEntry
    ? parseFloat(previousEntry.running_balance)
    : 0;

  // 2️⃣ Fetch entries in the range
  const entries = await Ledger.find({
    customer_id: customerId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  // 3️⃣ Calculate running balance dynamically
  let runningBalance = openingBalance;
  const ledgerEntries = [];

  // Add opening balance as first row
  ledgerEntries.push({
    date: start,
    particulars: "Opening Balance",
    debit: openingBalance > 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    balance: openingBalance,
  });

  // Add all ledger transactions
  for (const e of entries) {
    const debit = e.type === "DEBIT" ? parseFloat(e.amount) : 0;
    const credit = e.type === "CREDIT" ? parseFloat(e.amount) : 0;
    runningBalance += debit - credit;

    ledgerEntries.push({
      date: e.date,
      particulars: e.details,
      debit,
      credit,
      balance: runningBalance,
    });
  }

  // 4️⃣ Calculate closing balance
  const closingBalance =
    ledgerEntries.length > 0
      ? ledgerEntries[ledgerEntries.length - 1].balance
      : await getLastRunningBalance(customerId);

  // Add closing balance row
  ledgerEntries.push({
    date: end,
    particulars: "Closing Balance",
    debit: closingBalance > 0 ? closingBalance : 0,
    credit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
    balance: closingBalance,
  });

  return { openingBalance, ledgerEntries, closingBalance };
};

/**
 * 🔹 Ledger API (JSON Response)
 */
export const getLedger = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.body;
    if (!customerId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Customer ID and date range required" });
    }

    const ledgerData = await getLedgerData(customerId, startDate, endDate);

    return res.json(ledgerData);
  } catch (err) {
    console.error("Error fetching ledger:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * 🔹 Generate Ledger PDF using Puppeteer
 */
export const generateLedgerPDF = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;

    if (!customerId || !startDate || !endDate) {
      return res.status(400).json({
        message: "Customer ID, startDate, and endDate are required",
      });
    }

    // Fetch customer info
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // ✅ Reuse the same logic as getLedger()
    const ledgerData = await getLedgerData(customerId, startDate, endDate);

    if (!ledgerData || !ledgerData.ledgerEntries.length) {
      return res.status(404).json({ message: "No ledger data found" });
    }

    // Generate HTML
    const htmlContent = generateLedgerHTML({
      customer,
      startDate,
      endDate,
      ...ledgerData,
    });

    // Generate PDF via Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });

    await browser.close();

    const fileName = `Ledger_${customer.name}_${format(
      new Date(startDate),
      "dd-MM-yyyy"
    )}_to_${format(new Date(endDate), "dd-MM-yyyy")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating ledger PDF:", error);
    res.status(500).json({
      message: "Error generating ledger PDF",
      error: error.message,
    });
  }
};
