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
 *     summary: Get all production orders that are not READY
 *     tags: [Production]
 *     responses:
 *       200:
 *         description: List of pending production orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   order_id:
 *                     type: number
 *                   quantity:
 *                     type: number
 *                   status:
 *                     type: string
 *                     enum: [UN_PROCESSED, IN_PROCESSES]
 *                   inStock:
 *                     type: boolean
 *                   finished_good:
 *                     type: object
 *                     properties:
 *                       model:
 *                         type: string
 *                       type:
 *                         type: string
 *                       ratio:
 *                         type: string
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
