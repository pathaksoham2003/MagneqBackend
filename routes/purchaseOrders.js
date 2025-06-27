import express from 'express';
import { createPurchaseOrder, getAllPurchaseOrders, updatePurchaseOrder } from '../controllers/purchaseOrders.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: PurchaseOrder
 *   description: Manage raw material purchase orders
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseItem:
 *       type: object
 *       properties:
 *         raw_material_id:
 *           type: string
 *           description: MongoDB ObjectId of the raw material
 *         quantity:
 *           type: number
 *         status:
 *           type: string
 *     PurchaseOrder:
 *       type: object
 *       required:
 *         - vendor_name
 *         - purchasing_date
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         vendor_name:
 *           type: string
 *         purchasing_date:
 *           type: string
 *           format: date
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseItem'
 *         status:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/purchase_order:
 *   post:
 *     summary: Create a new purchase order
 *     tags: [PurchaseOrder]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseOrder'
 *     responses:
 *       201:
 *         description: Purchase order created
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', createPurchaseOrder);

/**
 * @swagger
 * /api/purchase_order:
 *   get:
 *     summary: Get all purchase orders
 *     tags: [PurchaseOrder]
 *     responses:
 *       200:
 *         description: List of all purchase orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PurchaseOrder'
 *       500:
 *         description: Failed to fetch purchase orders
 */
router.get('/', getAllPurchaseOrders);

/**
 * @swagger
 * /api/purchase_order/{id}:
 *   put:
 *     summary: Update a purchase order by ID
 *     tags: [PurchaseOrder]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the purchase order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: Fields to update in the purchase order
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor_name:
 *                 type: string
 *               purchasing_date:
 *                 type: string
 *                 format: date
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     raw_material_id:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     status:
 *                       type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Purchase order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchaseOrder'
 *       404:
 *         description: Purchase order not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', updatePurchaseOrder);

export default router;
