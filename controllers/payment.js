import PaymentRecieval from "../models/PaymentRecieval.js";
import Customer from "../models/Customers.js";
import Ledger from "../models/Ledger.js";
import logger from "../utils/logger.js";

export const createPayment = async (req, res, next) => {
  try {
    const { customerId, date_of_recieval, amount, description, transactionType, transactionId } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const payment = await PaymentRecieval.create({
      customer: customerId,
      date_of_recieval: date_of_recieval || new Date(),
      amount,
      description,
      transactionType,
      transactionId,
    });

    await Ledger.create({
      customer_id: customerId,
      date: date_of_recieval || new Date(),
      type: "CREDIT", // payment received = CREDIT
      amount,
      details: `${description || "Payment Received"} - ${transactionType}: ${transactionId}`,
    });

    logger.info(`Payment recorded: ${amount} for customer ${customer.name} by ${req.user.user_name}`);
    res.status(201).json({
      message: "Payment recorded successfully & ledger updated",
      payment,
    });
  } catch (error) {
    next(error);
  }
};