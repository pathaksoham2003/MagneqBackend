import PaymentRecieval from "../models/PaymentRecieval.js";
import Customer from "../models/Customers.js";
import Ledger from "../models/Ledger.js";

export const createPayment = async (req, res) => {
  try {
    const { customerId, date_of_recieval, amount, description } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const payment = await PaymentRecieval.create({
      customer: customerId,
      date_of_recieval: date_of_recieval || new Date(),
      amount,
      description,
    });

    await Ledger.create({
      customer_id: customerId,
      date: date_of_recieval || new Date(),
      type: "CREDIT", // payment received = CREDIT
      amount,
      details: description || "Payment Received",
    });

    res.status(201).json({
      message: "Payment recorded successfully & ledger updated",
      payment,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      message: "Error creating payment",
      error: error.message,
    });
  }
};