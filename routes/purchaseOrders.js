import express from 'express';
import {
  addStockToPurchaseOrder,
  createPurchaseOrder,
  getAllPurchases,
  getPurchaseOrderItems,
  updatePurchaseOrder,
  getPurchaseDetails,
  getPendingPurchases
} from '../controllers/purchaseOrders.js';

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
 *         quantity:
 *           type: number
 *         price_per_unit:
 *           type: number
 *         item_total_price:
 *           type: number
 *         recieved_quantity:
 *           type: number
 *         status:
 *           type: string
 *     PurchaseOrder:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         po_number:
 *           type: number
 *         vendor_name:
 *           type: string
 *         purchasing_date:
 *           type: string
 *           format: date
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseItem'
 *         total_price:
 *           type: number
 *         status:
 *           type: string
 *         created_at:
 *           type: string
 *         updated_at:
 *           type: string
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
 *             type: object
 *             required:
 *               - vendor_name
 *               - purchasing_date
 *               - items
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
 *                   required:
 *                     - raw_material_id
 *                     - quantity
 *                     - price_per_unit
 *                   properties:
 *                     raw_material_id:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price_per_unit:
 *                       type: number
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
 *     summary: Get all purchases with pagination
 *     tags: [PurchaseOrder]
 *     parameters:
 *       - in: query
 *         name: page_no
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: List of all purchase orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 header:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Production Id", "Vendor Name", "Date of purchase", "Order Details", "Status"]
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
 *                         example:
 *                           - "PRO-1"
 *                           - "Vendor X"
 *                           - "2025-07-03T00:00:00.000Z"
 *                           - ["ClassA/100", "ClassB/30"]
 *                           - "COMPLETED"
 *                 page_no:
 *                   type: integer
 *                 total_pages:
 *                   type: integer
 *                 total_items:
 *                   type: integer
 */

router.get('/', getAllPurchases);

router.get('/pending', getPendingPurchases);

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
 *         schema:
 *           type: string
 *         description: Purchase order document ID
 *     requestBody:
 *       required: true
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
 *                     price_per_unit:
 *                       type: number
 *                     item_total_price:
 *                       type: number
 *                     status:
 *                       type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Purchase order updated successfully
 *       404:
 *         description: Purchase order not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', updatePurchaseOrder);

/**
 * @swagger
 * /api/purchase_order/{po_id}:
 *   get:
 *     summary: Retrieve details of a specific purchase order
 *     description: Fetches vendor name, purchasing date, and raw material info for the selected purchase order.
 *     tags:
 *       - PurchaseOrder
 *     parameters:
 *       - in: path
 *         name: po_id
 *         required: true
 *         description: ID of the purchase order
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved purchase order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 vendor_name:
 *                   type: string
 *                 purchasing_date:
 *                   type: string
 *                   format: date
 *                 status:
 *                   type: string
 *                 po_number:
 *                   type: string
 *                 total_price:
 *                   type: number
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *       404:
 *         description: Purchase order not found
 *       500:
 *         description: Internal server error
 */
router.get('/:po_id', getPurchaseDetails);

/**
 * @swagger
 * /api/purchase_order/{po_number}/items:
 *   get:
 *     summary: Get items of a purchase order with max allowed quantity
 *     tags: [PurchaseOrder]
 *     parameters:
 *       - in: path
 *         name: po_number
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: class_type
 *         schema:
 *           type: string
 *           enum: [A, B, C]
 *     responses:
 *       200:
 *         description: List of items with max allowed quantity
 *       404:
 *         description: Purchase order not found
 *       500:
 *         description: Server error
 */
router.get('/:po_number/items', getPurchaseOrderItems);

/**
 * @swagger
 * /api/purchase_order/add_stock:
 *   patch:
 *     summary: Add stock to purchase order items and update PO status
 *     tags: [PurchaseOrder]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - po_id
 *               - items
 *             properties:
 *               po_id:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - item_id
 *                     - recieved_quantity
 *                   properties:
 *                     item_id:
 *                       type: string
 *                     recieved_quantity:
 *                       type: number
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Invalid request format
 *       404:
 *         description: Purchase order not found
 *       500:
 *         description: Server error
 */
router.patch('/add_stock', addStockToPurchaseOrder);

export default router;
