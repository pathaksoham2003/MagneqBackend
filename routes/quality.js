import express from "express";
import {
  createQuality,
  getAllQualities,
  updateQuality,
  deleteQuality,
  getSpecificQualityIssue,
} from "../controllers/quality.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Quality
 *   description: Quality issue tracking
 */

/**
 * @swagger
 * /api/quality:
 *   post:
 *     summary: Create a new quality issue
 *     tags: [Quality]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issue_type
 *             properties:
 *               issue_type:
 *                 type: string
 *                 enum: [Material, Delivery, Process, Employee]
 *                 description: Type of the issue
 *               description:
 *                 type: string
 *                 description: Description of the issue
 *               items:
 *                 type: array
 *                 description: Required if issue_type is 'Material'
 *                 items:
 *                   type: object
 *                   required:
 *                     - model
 *                     - type
 *                     - ratio
 *                     - power
 *                   properties:
 *                     model:
 *                       type: string
 *                     type:
 *                       type: string
 *                     ratio:
 *                       type: string
 *                     power:
 *                       type: string
 *                     order_number:
 *                       type: string
 *                       description: Related order number
 *     responses:
 *       201:
 *         description: Quality issue(s) created successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/Quality'
 *                 - $ref: '#/components/schemas/Quality'
 *       404:
 *         description: Finished good not found
 *       500:
 *         description: Failed to create quality issue
 */
router.post("/", authenticate, createQuality);

/**
 * @swagger
 * /api/quality:
 *   get:
 *     summary: Get all quality issues
 *     tags: [Quality]
 *     responses:
 *       200:
 *         description: List of all quality issues
 *       500:
 *         description: Failed to fetch quality issues
 */
router.get("/", authenticate, getAllQualities);
router.get("/:id", getSpecificQualityIssue);

/**
 * @swagger
 * /api/quality/{id}:
 *   put:
 *     summary: Update a quality issue by MongoDB _id
 *     tags: [Quality]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the quality issue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor:
 *                 type: string
 *               issue:
 *                 type: string
 *               action_taken:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Quality issue updated
 *       404:
 *         description: Issue not found
 *       500:
 *         description: Failed to update quality issue
 */
router.put("/:id", updateQuality);

/**
 * @swagger
 * /api/quality/{id}:
 *   delete:
 *     summary: Delete a quality issue by MongoDB _id
 *     tags: [Quality]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the quality issue
 *     responses:
 *       200:
 *         description: Issue deleted
 *       404:
 *         description: Issue not found
 *       500:
 *         description: Failed to delete issue
 */
router.delete("/:id", deleteQuality);

export default router;
