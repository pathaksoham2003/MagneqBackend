import express from 'express';
import {
  createQuality,
  getAllQualities,
  updateQuality,
  deleteQuality,
} from '../controllers/quality.js';

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
 *               - issue
 *             properties:
 *               vendor:
 *                 type: string
 *               issue:
 *                 type: string
 *               action_taken:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Quality issue created
 *       500:
 *         description: Failed to create quality issue
 */
router.post('/', createQuality);

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
router.get('/', getAllQualities);

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
router.put('/:id', updateQuality);

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
router.delete('/:id', deleteQuality);

export default router;
