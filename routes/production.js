import express from 'express';
import {
  getPendingProductionOrders,
  getProductionDetails,
  makeReady,
  startProduction,
} from '../controllers/production.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Production
 *   description: Production order management
 */

/**
 * @swagger
 * /api/production:
 *   get:
 *     summary: Get all pending production orders (not in READY status)
 *     tags: [Production]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: "Page number for pagination (default: 1)"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: "Number of items per page (default: 10)"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "Search by production number (number after PRO-)"
 *     responses:
 *       200:
 *         description: Paginated list of pending production orders in tabular format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 header:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Production Id", "Customer Name", "Date of Creation", "Order Details", "Quantity", "Status"]
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
 *                             - type: number
 *                         example: ["PRO-1", "Vendor X", "2025-07-03T00:00:00.000Z", "M1/Type-A/5:1/6", 6, "UN_PROCESSED"]
 *                 page_no:
 *                   type: integer
 *                   example: 1
 *                 total_pages:
 *                   type: integer
 *                   example: 2
 *                 total_items:
 *                   type: integer
 *                   example: 12
 */
router.get('/', getPendingProductionOrders);

/**
 * @swagger
 * /api/production/{id}:
 *   get:
 *     summary: Get raw material requirement and availability for a specific production
 *     tags: [Production]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Production ID
 *     responses:
 *       200:
 *         description: Detailed production requirement grouped by class
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 production_id:
 *                   type: string
 *                 order_id:
 *                   type: number
 *                 finished_good:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                     type:
 *                       type: string
 *                     ratio:
 *                       type: string
 *                 quantity:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [UN_PROCESSED, IN_PROCESSES, READY]
 *                 all_in_stock:
 *                   type: boolean
 *                 class_a:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       required:
 *                         type: number
 *                       available:
 *                         type: number
 *                       in_stock:
 *                         type: boolean
 *                 class_b:
 *                   type: array
 *                   items:
 *                     type: object
 *                 class_c:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Production not found
 */
router.get('/:id', getProductionDetails);

/**
 * @swagger
 * /api/production/{id}/start:
 *   post:
 *     summary: Start production and deduct raw materials
 *     tags: [Production]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Production ID
 *     responses:
 *       200:
 *         description: Production started, raw materials deducted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 production:
 *                   type: object
 *       400:
 *         description: Cannot start production (invalid state or insufficient materials)
 *       404:
 *         description: Production not found
 */
router.post('/:id/start', startProduction);

/**
 * @swagger
 * /api/production/{id}/ready:
 *   put:
 *     summary: Mark a production as READY and update related data
 *     tags: [Production]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the production to update
 *     responses:
 *       200:
 *         description: Production marked as READY, FinishedGood units incremented, and Sales updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Production not found
 *       500:
 *         description: Server error
 */
router.put('/:id/ready', makeReady);

export default router;
