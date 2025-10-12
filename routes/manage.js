import express from "express";
import {
  createUser,
  getFinishedGoods,
  getRawMaterialsByClass,
  getUsers,
  getUsersByRole,
  getAllCustomers,
  getAllVendors,
  getSupplierById,
  updateSupplier,
  getCustomerById,
  updateCustomer,
  getUserById,
  updateUser,
} from "../controllers/manage.js";
import { authenticate } from "../middlewares/authMiddleware.js";

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
router.get("/finished_good", authenticate, getFinishedGoods);

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
router.get("/getAllCustomer", getAllCustomers);
router.get("/getAllVendor", getAllVendors);

/**
 * @swagger
 * /api/manage/supplier/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier details
 *       404:
 *         description: Supplier not found
 *   put:
 *     summary: Update supplier
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 *       404:
 *         description: Supplier not found
 */
router.get("/supplier/:id", getSupplierById);
router.put("/supplier/:id", updateSupplier);

/**
 * @swagger
 * /api/manage/customer/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer details
 *       404:
 *         description: Customer not found
 *   put:
 *     summary: Update customer
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               pin_code:
 *                 type: string
 *               state:
 *                 type: string
 *               gst_no:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       404:
 *         description: Customer not found
 */
router.get("/customer/:id", getCustomerById);
router.put("/customer/:id", updateCustomer);

/**
 * @swagger
 * /api/manage/user/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update user
 *     tags: [Manage]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.get("/user/:id", getUserById);
router.put("/user/:id", updateUser);

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
