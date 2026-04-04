import puppeteer from "puppeteer";
import { format } from "date-fns";
import Ledger from "../models/Ledger.js";
import Customer from "../models/Customers.js";
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { generateLedgerHTML } from "../utils/ledgerTemplate.js";
import { getLastRunningBalance } from "../utils/ledgerUtils.js";

/**
 * 🔹 Common Ledger Logic (used by both API & PDF)
 */
export const getLedgerData = async (customerId, startDate, endDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

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
export const getLedger = async (req, res, next) => {
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
    next(err);
  }
};

/**
 * 🔹 Generate Ledger PDF using Puppeteer
 */
export const generateLedgerPDF = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get first and last ledger entry dates for a customer
 */
export const getLedgerDateRange = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    // Get first entry
    const firstEntry = await Ledger.findOne({ customer_id: customerId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // Get last entry
    const lastEntry = await Ledger.findOne({ customer_id: customerId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.json({
      firstDate: firstEntry?.date ? new Date(firstEntry.date).toISOString() : null,
      lastDate: lastEntry?.date ? new Date(lastEntry.date).toISOString() : null,
      hasEntries: !!firstEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create customer opening balance entry
 * If no ledger entries exist, create the first entry
 * If entries exist, the new entry must be before the first entry OR after the last entry
 */
export const createOpeningBalance = async (req, res, next) => {
  try {
    const { customerId, date, creditAmount, debitAmount, description } = req.body;

    if (!customerId || !date) {
      return res.status(400).json({
        message: "Customer ID and date are required",
      });
    }

    if ((!creditAmount || creditAmount === 0) && (!debitAmount || debitAmount === 0)) {
      return res.status(400).json({
        message: "Either credit or debit amount must be provided",
      });
    }

    // Validate customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Get today's date (end of day)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Validate: entry date cannot be in the future
    if (entryDate > today) {
      return res.status(400).json({
        message: "Entry date cannot be in the future",
      });
    }

    // Get first and last entry dates
    const firstEntry = await Ledger.findOne({ customer_id: customerId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const lastEntry = await Ledger.findOne({ customer_id: customerId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // If ledger entries exist, validate date
    if (firstEntry) {
      const firstDate = new Date(firstEntry.date);
      firstDate.setHours(0, 0, 0, 0);

      if (lastEntry) {
        const lastDate = new Date(lastEntry.date);
        lastDate.setHours(23, 59, 59, 999);

        // Entry date must be:
        // 1. Before first entry (and before today), OR
        // 2. After last entry BUT before today (inclusive today)
        // Disallow: between first and last entry (inclusive)
        if (entryDate >= firstDate && entryDate <= lastDate) {
          return res.status(400).json({
            message: `Entry date must be before the first entry (${format(firstDate, "dd-MM-yyyy")}) or after the last entry (${format(lastDate, "dd-MM-yyyy")}) but not in the future`,
            firstDate: firstDate.toISOString(),
            lastDate: lastDate.toISOString(),
          });
        }

        // If entry is after last date, it must be <= today
        if (entryDate > lastDate && entryDate > today) {
          return res.status(400).json({
            message: `Entry date after the last entry (${format(lastDate, "dd-MM-yyyy")}) must be today or earlier`,
            firstDate: firstDate.toISOString(),
            lastDate: lastDate.toISOString(),
          });
        }
      } else {
        // Only first entry exists (shouldn't happen, but handle it)
        // Entry must be before first date (and before today)
        if (entryDate >= firstDate) {
          return res.status(400).json({
            message: `Entry date must be before the first entry (${format(firstDate, "dd-MM-yyyy")})`,
            firstDate: firstDate.toISOString(),
            lastDate: null,
          });
        }
      }
    }

    // Calculate previous balance
    let previousBalance = 0;
    if (firstEntry) {
      if (entryDate < firstEntry.date) {
        // Entry is before first entry, balance starts from 0
        previousBalance = 0;
      } else if (lastEntry && entryDate > lastEntry.date) {
        // Entry is after last entry, use last entry's running balance
        previousBalance = parseFloat(lastEntry.running_balance || 0);
      }
    } else {
      // No entries exist, this is the first entry - balance starts from 0
      previousBalance = 0;
    }

    const entries = [];
    let currentBalance = previousBalance;

    // Create CREDIT entry if provided
    if (creditAmount && creditAmount > 0) {
      const creditValue = parseFloat(creditAmount);
      const creditBalance = currentBalance - creditValue;
      
      const creditEntry = await Ledger.create({
        customer_id: customerId,
        date: entryDate,
        type: "CREDIT",
        amount: mongoose.Types.Decimal128.fromString(creditValue.toString()),
        details: description || "Opening Balance - Credit",
        running_balance: mongoose.Types.Decimal128.fromString(creditBalance.toString()),
      });

      // Create transaction record
      const creditTransaction = new Transaction({
        model_name: "LEDGER",
        reference_id: creditEntry._id,
        prev_value: mongoose.Types.Decimal128.fromString(currentBalance.toString()),
        updated_value: mongoose.Types.Decimal128.fromString(creditBalance.toString()),
        label: description || `Opening Balance Credit - ${customer.name}`,
        field_name: "running_balance",
        transaction_type: "CREDIT",
        created_by: req.user?.id || null,
      });
      await creditTransaction.save();

      entries.push(creditEntry);
      currentBalance = creditBalance; // Update for next entry
    }

    // Create DEBIT entry if provided
    if (debitAmount && debitAmount > 0) {
      const debitValue = parseFloat(debitAmount);
      const debitBalance = currentBalance + debitValue;
      
      const debitEntry = await Ledger.create({
        customer_id: customerId,
        date: entryDate,
        type: "DEBIT",
        amount: mongoose.Types.Decimal128.fromString(debitValue.toString()),
        details: description || "Opening Balance - Debit",
        running_balance: mongoose.Types.Decimal128.fromString(debitBalance.toString()),
      });

      // Create transaction record
      const debitTransaction = new Transaction({
        model_name: "LEDGER",
        reference_id: debitEntry._id,
        prev_value: mongoose.Types.Decimal128.fromString(currentBalance.toString()),
        updated_value: mongoose.Types.Decimal128.fromString(debitBalance.toString()),
        label: description || `Opening Balance Debit - ${customer.name}`,
        field_name: "running_balance",
        transaction_type: "DEBIT",
        created_by: req.user?.id || null,
      });
      await debitTransaction.save();

      entries.push(debitEntry);
    }

    logger.info(`Opening balance created for customer ${customer.name} by ${req.user.user_name}. Entries: ${entries.length}`);
    res.status(201).json({
      message: "Opening balance entries created successfully",
      entries,
    });
  } catch (error) {
    next(error);
  }
};
