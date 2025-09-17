import express from 'express';
import { createInvoice, getAllInvoices, getInvoicesByCustomer } from '../controllers/invoice.js';

const router = express.Router();

router.post("/", createInvoice)
router.get("/customer/:customerId", getInvoicesByCustomer);
router.get("/", getAllInvoices)

export default router;