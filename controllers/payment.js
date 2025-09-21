import PaymentRecieval from "../models/PaymentRecieval.js";
import Customer from "../models/Customers.js";

export const createPayment = async (req, res) => {
  try {
    const { customerId, date_of_recieval, amount, description } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const payment = new PaymentRecieval({
      customer: customerId,
      date_of_recieval: date_of_recieval || new Date(),
      amount,
      description,
    });

    await payment.save();

    res.status(201).json({
      message: "Payment recorded successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating payment",
      error: error.message,
    });
  }
};