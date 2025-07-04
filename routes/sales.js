import express from "express";
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  approveSale,
} from "../controllers/sales.js";

const router = express.Router();

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
 *                     finished_good:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     rate_per_unit:
 *                       type: number
 *                       format: float
 *               customer_name:
 *                 type: string
 *               magneq_user:
 *                 type: string
 *               description:
 *                 type: string
 *               delivery_date:
 *                 type: string
 *                 format: date
 *               created_by:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sale created successfully
 */
router.post("/", createSale);

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
router.patch("/:id/approve", approveSale);

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
router.get("/", getAllSales);

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

export default router;
