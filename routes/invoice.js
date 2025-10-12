import express from "express";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByCustomer,
  updateTransportDetails,
  updateInvoiceStatus,
  deleteInvoice,
} from "../controllers/invoice.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", createInvoice);
router.get("/customer/:customerId", getInvoicesByCustomer);
router.get("/", getAllInvoices);
router.get("/:id", getInvoiceById);
router.patch("/:id/transport", updateTransportDetails);
router.patch("/:id/status", updateInvoiceStatus);
router.delete("/:id", deleteInvoice);

export default router;
