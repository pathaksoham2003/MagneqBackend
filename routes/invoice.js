import express from "express";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByCustomer,
  updateTransportDetails,
  updateInvoiceStatus,
  deleteInvoice,
  generateInvoicePDF,
} from "../controllers/invoice.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/invoice:
 *   get:
 *     summary: Get all invoices with optional search and date filtering
 *     tags: [Invoice]
 *     parameters:
 *       - in: query
 *         name: page_no
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: "John Doe"
 *         description: Search by invoice number (numeric) or customer name (text)
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *           example: "60f5a3c3f10a5c3f88e8e3b1"
 *         description: Filter by specific customer ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Filter invoices from this date onwards (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Filter invoices up to this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of invoices with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 header:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Invoice No", "Invoice Date", "Customer Name", "Invoice Details", "Status"]
 *                 item:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "60f5a3c3f10a5c3f88e8e3b1"
 *                       data:
 *                         type: array
 *                         items:
 *                           oneOf:
 *                             - type: string
 *                             - type: array
 *                               items:
 *                                 type: string
 *                         example: ["INV-1", "2024-01-15T10:30:00.000Z", "John Doe", ["M1/Type-A/5:1/1"], "PROCESSED"]
 *                 page_no:
 *                   type: integer
 *                   example: 1
 *                 total_pages:
 *                   type: integer
 *                   example: 5
 *                 total_items:
 *                   type: integer
 *                   example: 50
 *       400:
 *         description: Bad request - invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getAllInvoices);

router.post("/", createInvoice);
router.get("/customer/:customerId", getInvoicesByCustomer);
router.get("/:id", getInvoiceById);
router.get("/:id/pdf", generateInvoicePDF);
router.patch("/:id/transport", updateTransportDetails);
router.patch("/:id/status", updateInvoiceStatus);
router.delete("/:id", deleteInvoice);

export default router;
