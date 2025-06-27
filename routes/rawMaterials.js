import express from 'express';
const router = express.Router();
import {
  getAllRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial
} from '../controllers/rawMaterials.js';

/**
 * @swagger
 * tags:
 *   name: RawMaterial
 *   description: Raw material management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RawMaterial:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the raw material
 *         class_type:
 *           type: string
 *           enum: [A, B, C]
 *           description: Type of raw material
 *         other_specification:
 *           type: object
 *           additionalProperties: true
 *           description: Arbitrary key-value specs (for A and C)
 *         quantity:
 *           type: number
 *           description: Quantity of raw material
 *         casting_product:
 *           type: string
 *           description: Required for type A
 *         status:
 *           type: string
 *           description: Required for type B
 *         product:
 *           type: string
 *           description: Required for type B
 *         select_items:
 *           type: array
 *           description: Required for type C
 *           items:
 *             type: object
 *             additionalProperties: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         expiry_date:
 *           type: string
 *           format: date
 *           description: Required for type C
 */

/**
 * @swagger
 * /api/raw_material:
 *   get:
 *     summary: Get all raw materials grouped by class_type
 *     tags: [RawMaterial]
 *     responses:
 *       200:
 *         description: Grouped raw materials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 A:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RawMaterial'
 *                 B:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RawMaterial'
 *                 C:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RawMaterial'
 */
router.get('/', getAllRawMaterials);

/**
 * @swagger
 * /api/raw_material/{id}:
 *   get:
 *     summary: Get a raw material by ID
 *     tags: [RawMaterial]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Raw material ID
 *     responses:
 *       200:
 *         description: A raw material object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RawMaterial'
 *       404:
 *         description: Raw material not found
 */
router.get('/:id', getRawMaterialById);

/**
 * @swagger
 * /api/raw_material:
 *   post:
 *     summary: Create a new raw material
 *     tags: [RawMaterial]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RawMaterial'
 *     responses:
 *       201:
 *         description: Created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', createRawMaterial);

/**
 * @swagger
 * /api/raw_material/{id}:
 *   put:
 *     summary: Update an existing raw material
 *     tags: [RawMaterial]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Raw material ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RawMaterial'
 *     responses:
 *       200:
 *         description: Updated successfully
 *       400:
 *         description: Update failed due to validation
 *       404:
 *         description: Raw material not found
 */
router.put('/:id', updateRawMaterial);

/**
 * @swagger
 * /api/raw_material/{id}:
 *   delete:
 *     summary: Delete a raw material by ID
 *     tags: [RawMaterial]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Raw material ID
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */
router.delete('/:id', deleteRawMaterial);

export default router;
