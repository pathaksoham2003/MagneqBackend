import Ledger from "../models/Ledger.js";

// Get ledger for a customer in a date range
export const getLedger = async (req, res) => {
    try {
        const { customerId, startDate, endDate } = req.body;
        if (!customerId || !startDate || !endDate) {
            return res.status(400).json({ message: "Customer ID and date range required" });
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 1. Opening balance
        const opening = await Ledger.aggregate([
            { $match: { customer_id: customerId, date: { $lt: start } } },
            {
                $group: {
                    _id: null,
                    debit: { $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] } },
                    credit: { $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] } },
                },
            },
        ]);
        const openingBalance = (opening[0]?.debit || 0) - (opening[0]?.credit || 0);
        
        // 2. Entries in date range
        const entries = await Ledger.find({
            customer_id: customerId,
            date: { $gte: start, $lte: end },
        }).sort({ date: 1 });
        
        // 3. Compute running balance
        let runningBalance = openingBalance;
        const ledgerEntries = entries.map(e => {
            const amount = parseFloat(e.amount.toString());
            if (e.type === "DEBIT") runningBalance += amount;
            else runningBalance -= amount;
            
            return {
                date: e.date,
                particulars: e.details,
                debit: e.type === "DEBIT" ? amount : 0,
                credit: e.type === "CREDIT" ? amount : 0,
                balance: runningBalance,
            };
        });
        
        res.json({
            openingBalance,
            ledgerEntries,
            closingBalance: runningBalance,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
