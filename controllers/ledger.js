import Ledger from "../models/Ledger.js";

export const getLedger = async (req, res) => {
    try {
      const { customerId, startDate, endDate } = req.body;
      if (!customerId || !startDate || !endDate) {
        return res
          .status(400)
          .json({ message: "Customer ID and date range required" });
      }
  
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
  
      // Add closing balance as final row
      ledgerEntries.push({
        date: end,
        particulars: "Closing Balance",
        debit: closingBalance > 0 ? closingBalance : 0,
        credit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
        balance: closingBalance,
      });
  
      // 5️⃣ Send final result
      return res.json({
        openingBalance,
        ledgerEntries,
        closingBalance,
      });
    } catch (err) {
      console.error("Error fetching ledger:", err);
      return res.status(500).json({
        message: "Server error",
        error: err.message,
      });
    }
  };