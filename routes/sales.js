import express from "express";
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  approveSale,
  rejectSale,
  updateSaleStatus,
  saleAmountRecieved,
  getTopStats,
} from "../controllers/sales.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/sales/top-stats:
 *   get:
 *     summary: Get top statistics
 *     tags: [Sales]
 *     responses:
 *       200:
 *         description: Sales top statistics fetched
 */
router.get("/top-stats", getTopStats);

/**
 * @swagger
 * components:
 *   schemas:
 *     FinishedGoodItem:
 *       type: object
 *       properties:
 *         finished_good:
 *           type: string
 *         rate_per_unit:
 *           type: number
 *           format: float
 *         quantity:
 *           type: number
 *         item_total_price:
 *           type: number
 *           format: float
 *         status:
 *           type: boolean
 *
 *     Sale:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         order_id:
 *           type: number
 *         finished_goods:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FinishedGoodItem'
 *         customer_name:
 *           type: string
 *         magneq_user:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [RECEIVED, INPROCESS, PROCESSED, DISPATCHED, DELIVERED, CANCELLED]
 *         delivery_date:
 *           type: string
 *           format: date
 *         total_amount:
 *           type: number
 *           format: float
 *         created_by:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/sales:
 *   post:
 *     summary: Create a new sale
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               finished_goods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                       example: "X200"
 *                     type:
 *                       type: string
 *                       example: "AC"
 *                     ratio:
 *                       type: string
 *                       example: "1:2"
 *                     power:
 *                       type: number
 *                       format: float
 *                       example: 2.5
 *                     quantity:
 *                       type: number
 *                       example: 10
 *                     rate_per_unit:
 *                       type: number
 *                       format: float
 *                       example: 1500.50
 *               customer_name:
 *                 type: string
 *                 example: "John Doe"
 *               magneq_user:
 *                 type: string
 *                 example: "sales_rep_01"
 *               description:
 *                 type: string
 *                 example: "Urgent order"
 *               delivery_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-07-15"
 *               created_by:
 *                 type: string
 *                 description: MongoDB ObjectId of the user
 *                 example: "60f5a3c3f10a5c3f88e8e3b1"
 *     responses:
 *       201:
 *         description: Sale created successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Finished good not found
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticate, createSale);

/**
 * @swagger
 * /api/sales/{id}/approve:
 *   patch:
 *     summary: Approve a sales order and generate production orders
 *     tags: [Sales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the sales order to approve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale approved and productions created
 *       404:
 *         description: Sale not found
 *       400:
 *         description: Sale is already approved or processed
 */
router.patch("/:id/approve", authenticate, approveSale);
/**
 * @swagger
 * /api/sales/{id}/reject:
 *   patch:
 *     summary: Reject a sales order
 *     tags: [Sales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the sales order to reject
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale rejected
 *       404:
 *         description: Sale not found
 *       400:
 *         description: Sale is already processed
 */
router.patch("/:id/reject", authenticate, rejectSale);

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales with optional search and pagination
 *     tags: [Sales]
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
 *           type: integer
 *           example: 5
 *         description: Search by numeric order ID (without SO- prefix)
 *     responses:
 *       200:
 *         description: List of all sales (paginated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 header:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Order Id", "Date of Creation", "Customer Name", "Order Details", "Status"]
 *                 item:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "686692dd4625cb568fd0c15c"
 *                       data:
 *                         type: array
 *                         items:
 *                           oneOf:
 *                             - type: string
 *                             - type: array
 *                               items:
 *                                 type: string
 *                         example: ["SO-1", "2025-07-03T14:25:33.276Z", "string", ["M1/Type-A/5:1/1"], "PROCESSED"]
 *                 page_no:
 *                   type: integer
 *                   example: 1
 *                 total_pages:
 *                   type: integer
 *                   example: 1
 *                 total_items:
 *                   type: integer
 *                   example: 1
 */
router.get("/", authenticate, getAllSales);

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     summary: Get a sale by ID
 *     tags: [Sales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale found
 */
router.get("/:id", getSaleById);

/**
 * @swagger
 * /api/sales/{id}:
 *   put:
 *     summary: Update a sale
 *     tags: [Sales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Sale'
 *     responses:
 *       200:
 *         description: Sale updated successfully
 */
router.put("/:id", updateSale);

/**
 * @swagger
 * /api/sales/{id}:
 *   delete:
 *     summary: Delete a sale
 *     tags: [Sales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale deleted successfully
 */
router.delete("/:id", deleteSale);

/**
 * @swagger
 * /api/sales/{id}/status:
 *   patch:
 *     summary: Update Sales Order Status
 *     description: Progresses the status of a sales order (e.g., from PROCESSED to DISPATCHED, then DELIVERED).
 *     tags:
 *       - Sales
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique identifier for the sales order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PROCESSED, DISPATCHED, DELIVERED]
 *                 example: DISPATCHED
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Status updated to DISPATCHED
 *                 updatedStatus:
 *                   type: string
 *                   example: DISPATCHED
 *       400:
 *         description: Invalid status or missing ID
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/status", updateSaleStatus);

/**
 * @swagger
 * /api/sales/{id}/recievedAmt:
 *   patch:
 *     summary: Update Sales Order Recieved Amount
 *     description: Updates and Stores the partial amount receieved from the customer to calculate the balance due.
 *     tags:
 *       - Sales
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique identifier for the sales order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recieved_amt:
 *                 type: number
 *             required:
 *               - recieved_amt
 *     responses:
 *       200:
 *         description: Recieved Amount updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Amount updated
 *       400:
 *         description: Invalid amount or missing ID
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/recievedAmt", saleAmountRecieved);

export default router;
