// utils/ledgerUtils.js
import Ledger from "../models/Ledger.js";

export const getLastRunningBalance = async (customerId) => {
  const lastEntry = await Ledger.findOne({ customer_id: customerId })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  return lastEntry ? parseFloat(lastEntry.running_balance) : 0;
};
