import express from "express";
import {
  createFinishedGood,
  getAllFinishedGoods,
  getFinishedGoodById,
  updateFinishedGood,
  deleteFinishedGood,
  getModelConfig,
} from "../controllers/finishedGoods.js";

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
router.post("/", createFinishedGood);

/**
 * @swagger
 * /api/finished_goods/modal_config:
 *   get:
 *     summary: Get model configuration for finished goods dropdowns
 *     tags: [FinishedGoods]
 *     responses:
 *       200:
 *         description: Successfully retrieved model configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   powers:
 *                     type: array
 *                     items:
 *                       type: number
 *                       format: float
 *                   ratios:
 *                     type: object
 *                     additionalProperties:
 *                       type: array
 *                       items:
 *                         type: string
 *             example:
 *               MA-102:
 *                 powers: [0.25, 0.37, 0.5, 0.75]
 *                 ratios:
 *                   "0.25": ["15:1", "20:1"]
 *                   "0.37": ["25:1", "30:1"]
 *                   "0.5": ["35:1", "40:1"]
 *                   "0.75": ["35:1", "40:1"]
 *               MA-128:
 *                 powers: [0.37, 0.75, 1.1, 1.5]
 *                 ratios:
 *                   "1": ["10:1", "15:1"]
 *                   "2": ["20:1", "25:1"]
 *               MA-142:
 *                 powers: [0.75, 1.1, 1.5, 2.2]
 *                 ratios:
 *                   "0.75": ["18:1", "22:1"]
 *                   "1.5": ["26:1", "32:1"]
 *               MA-162:
 *                 powers: [1.1, 1.5, 2.2, 3.7]
 *                 ratios:
 *                   "2": ["10:1", "12:1"]
 *                   "3": ["15:1", "18:1"]
 *       500:
 *         description: Server error
 */
router.get("/modal_config", getModelConfig);

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
router.get("/", getAllFinishedGoods);

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
router.get("/:id", getFinishedGoodById);


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
router.put("/:id", updateFinishedGood);

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
router.delete("/:id", deleteFinishedGood);

export default router;
