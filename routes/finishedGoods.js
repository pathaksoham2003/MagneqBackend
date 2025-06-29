import express from 'express';
import {
  createFinishedGood,
  getAllFinishedGoods,
  getFinishedGoodById,
  updateFinishedGood,
  deleteFinishedGood,
} from '../controllers/finishedGoods.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: FinishedGoods
 *   description: API for managing finished goods
 */

/**
 * @swagger
 * /api/finished_goods:
 *   post:
 *     summary: Create a new finished good
 *     tags: [FinishedGoods]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *               type:
 *                 type: string
 *               ratio:
 *                 type: string
 *               other_specification:
 *                 type: object
 *               raw_materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     raw_material_id:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               units:
 *                 type: number
 *     responses:
 *       201:
 *         description: Finished good created successfully
 *       400:
 *         description: Bad request
 */
router.post('/', createFinishedGood);

/**
 * @swagger
 * /api/finished_goods:
 *   get:
 *     summary: Get all finished goods
 *     tags: [FinishedGoods]
 *     responses:
 *       200:
 *         description: A list of finished goods
 */
router.get('/', getAllFinishedGoods);

/**
 * @swagger
 * /api/finished_goods/{id}:
 *   get:
 *     summary: Get a finished good by ID
 *     tags: [FinishedGoods]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finished good ID
 *     responses:
 *       200:
 *         description: Finished good found
 *       404:
 *         description: Finished good not found
 */
router.get('/:id', getFinishedGoodById);

/**
 * @swagger
 * /api/finished_goods/{id}:
 *   put:
 *     summary: Update a finished good by ID
 *     tags: [FinishedGoods]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finished good ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Finished good updated successfully
 *       404:
 *         description: Finished good not found
 */
router.put('/:id', updateFinishedGood);

/**
 * @swagger
 * /api/finished_goods/{id}:
 *   delete:
 *     summary: Delete a finished good by ID
 *     tags: [FinishedGoods]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finished good ID
 *     responses:
 *       200:
 *         description: Finished good deleted successfully
 *       404:
 *         description: Finished good not found
 */
router.delete('/:id', deleteFinishedGood);

export default router;
