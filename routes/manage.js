import express from "express";
import {
  createUser,
  getFinishedGoods,
  getRawMaterialsByClass,
  getUsers,
  getUsersByRole,
} from "../controllers/manage.js";

const router = express.Router();

/**
 * @swagger
 * /api/manage/user:
 *   get:
 *     summary: Get all users
 *     tags: [Manage]
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedUserResponse'
 *       400:
 *         description: Failed to fetch users
 *   post:
 *     summary: Create a new user
 *     tags: [Manage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - role
 *               - user_name
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               role:
 *                 type: string
 *                 example: admin
 *               user_name:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing or invalid input
 */
router.post("/manage_user", createUser);

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Get users by role
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Users filtered by role
 */
router.get('/manage_user', getUsersByRole);

/**
 * @swagger
 * /api/manage/finished_good:
 *   get:
 *     summary: Get all finished goods
 *     tags: [Manage]
 *     responses:
 *       200:
 *         description: Paginated list of finished goods
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedFinishedGoodsResponse'
 *       400:
 *         description: Failed to fetch finished goods
 */
router.get("/finished_good", getFinishedGoods);

/**
 * @swagger
 * /api/manage/raw_material/{class_type}:
 *   get:
 *     summary: Get raw materials by class
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: class_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [A, B, C]
 *         description: Class type of the raw material
 *     responses:
 *       200:
 *         description: Paginated list of raw materials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedRawMaterialResponse'
 *       400:
 *         description: Failed to fetch raw materials
 */
router.get("/raw_material/:class_type", getRawMaterialsByClass);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         role:
 *           type: string
 *         user_name:
 *           type: string
 *         password:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ItemData:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             type: string
 *     PaginatedUserResponse:
 *       type: object
 *       properties:
 *         header:
 *           type: array
 *           items:
 *             type: string
 *         item:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ItemData'
 *         page_no:
 *           type: integer
 *         total_pages:
 *           type: integer
 *         total_items:
 *           type: integer
 *     PaginatedFinishedGoodsResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/PaginatedUserResponse'
 *     PaginatedRawMaterialResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/PaginatedUserResponse'
 */
