import express from 'express';
const router = express.Router();
import {
  getAllRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  getFilteredRawMaterials,
  getRawMaterialsByClass,
  getRawMaterialFilterConfig
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
 *         name:
 *           type: string
 *           description: Required for type A / B
 *         status:
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
 * /api/raw_material/filter_config:
 *   get:
 *     summary: Get filter configuration for raw materials
 *     tags: [RawMaterial]
 *     responses:
 *       200:
 *         description: Filter configuration object based on class type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   label:
 *                     type: string
 *                     description: Display name of the filter field
 *                   type:
 *                     type: string
 *                     enum: [text, select]
 *                     description: Type of input for filter (e.g., dropdown or text input)
 *                   options:
 *                     type: array
 *                     description: List of selectable options (for type=select)
 *                     items:
 *                       type: string
 *       500:
 *         description: Server error
 */
router.get("/filter_config",getRawMaterialFilterConfig)

/**
 * @swagger
 * /api/raw_material/search:
 *   get:
 *     summary: Get filtered raw materials
 *     description: Fetch raw materials filtered by class type, type, model, or name.
 *     tags: [RawMaterial]
 *     parameters:
 *       - in: query
 *         name: class_type
 *         schema:
 *           type: string
 *           enum: [A, B, C]
 *         description: Class type of the raw material (A, B, or C)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Specific type of the raw material
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Model of the raw material
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Name of the raw material
 *     responses:
 *       200:
 *         description: List of filtered raw materials
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   class_type:
 *                     type: string
 *                     enum: [A, B, C]
 *                   type:
 *                     type: string
 *                   model:
 *                     type: string
 *                   quantity:
 *                     type: object
 *                     description: Quantity fields vary by class type
 *                   [otherFields]:
 *                     description: Other fields filtered via `filterFieldsByClass`
 *       500:
 *         description: Internal server error
 */
router.get('/search', getFilteredRawMaterials);

/**
 * @swagger
 * /api/raw_material/{class_type}:
 *   get:
 *     summary: Get raw materials by class type with pagination and search
 *     tags: [RawMaterial]
 *     parameters:
 *       - in: path
 *         name: class_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [A, B, C]
 *         description: Class type of the raw materials
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering by name, casting name, or specification
 *     responses:
 *       200:
 *         description: List of raw materials filtered by class
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 header:
 *                   type: array
 *                   description: Array of dynamic field names (depends on class type)
 *                   items:
 *                     type: string
 *                 item:
 *                   type: array
 *                   description: List of raw material records
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Raw material ID
 *                       data:
 *                         type: array
 *                         description: Values corresponding to the header fields
 *                         items:
 *                           type: string
 *                 page_no:
 *                   type: integer
 *                   description: Current page number
 *                 total_pages:
 *                   type: integer
 *                   description: Total number of pages
 *                 total_items:
 *                   type: integer
 *                   description: Total number of raw materials matching the filter
 *       400:
 *         description: Invalid class type
 *       500:
 *         description: Server error
 */
router.get("/:class_type", getRawMaterialsByClass);

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
