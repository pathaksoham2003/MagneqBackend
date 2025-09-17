import express from 'express';
import { createInvoice, getAllInvoices, getInvoiceById, getInvoicesByCustomer } from '../controllers/invoice.js';

const router = express.Router();

router.post("/", createInvoice)
router.get("/customer/:customerId", getInvoicesByCustomer);
router.get("/", getAllInvoices)
router.get("/:id", getInvoiceById)


export default router;