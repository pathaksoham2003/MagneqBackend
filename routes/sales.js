import express from "express";
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/sales.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     FinishedGoodItem:
 *       type: object
 *       properties:
 *         raw_material_id:
 *           type: string
 *           description: ObjectId of the Finished Good
 *         quantity:
 *           type: number
 *           description: Quantity of this finished good
 *
 *     Sale:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         order_id:
 *           type: number
 *           description: Auto-incremented numeric order ID
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
 *         created_by:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Production:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         order_id:
 *           type: number
 *         finished_good:
 *           type: string
 *           description: ObjectId of the Finished Good
 *         status:
 *           type: string
 *           enum: [IN_STOCK, NOT_IN_STOCK, READY]
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
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
 *                       description: ObjectId of the finished good
 *                     quantity:
 *                       type: number
 *                       description: Quantity of this finished good
 *               customer_name:
 *                 type: string
 *               magneq_user:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [RECEIVED, INPROCESS, PROCESSED, DISPATCHED, DELIVERED, CANCELLED]
 *               delivery_date:
 *                 type: string
 *                 format: date
 *               created_by:
 *                 type: string
 *                 description: ObjectId of the user creating the sale
 *     responses:
 *       201:
 *         description: Sale created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sale:
 *                   $ref: '#/components/schemas/Sale'
 *                 productions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Production'
 *       400:
 *         description: Bad request
 */
router.post("/", createSale);

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales
 *     tags: [Sales]
 *     responses:
 *       200:
 *         description: List of all sales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sale'
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
 *         description: Sale ID
 *     responses:
 *       200:
 *         description: Sale found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sale'
 *       404:
 *         description: Sale not found
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
 *         description: Sale ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Sale'
 *     responses:
 *       200:
 *         description: Sale updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sale'
 *       404:
 *         description: Sale not found
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
 *         description: Sale ID
 *     responses:
 *       200:
 *         description: Sale deleted successfully
 *       404:
 *         description: Sale not found
 */
router.delete("/:id", deleteSale);

export default router;
