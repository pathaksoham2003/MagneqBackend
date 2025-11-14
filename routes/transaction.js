import express from "express";
import {
  createTransaction,
  updateRawMaterialStock,
  updateFinishedGoodUnits,
  getTransactions,
  getTransactionById,
} from "../controllers/transaction.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: API for managing transactions
 */

/**
 * @swagger
 * /api/transaction:
 *   post:
 *     summary: Create a transaction record
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model_name
 *               - reference_id
 *               - updated_value
 *               - label
 *               - field_name
 *               - transaction_type
 *             properties:
 *               model_name:
 *                 type: string
 *                 enum: [raw_material, finished_good, ledger]
 *               reference_id:
 *                 type: string
 *               prev_value:
 *                 type: number
 *               updated_value:
 *                 type: number
 *               label:
 *                 type: string
 *               field_name:
 *                 type: string
 *               transaction_type:
 *                 type: string
 *                 enum: [STOCK_UPDATE, UNIT_UPDATE, MANUAL_ADJUSTMENT, PRODUCTION, PURCHASE, SALES, CUSTOMER_OPENING_BALANCE, LEDGER_ENTRY]
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *       400:
 *         description: Bad request
 */
router.post("/", authenticate, createTransaction);

/**
 * @swagger
 * /api/transaction/raw-material/{id}:
 *   put:
 *     summary: Update raw material stock and create transaction
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - field_name
 *               - value
 *               - label
 *             properties:
 *               field_name:
 *                 type: string
 *               value:
 *                 type: number
 *               label:
 *                 type: string
 *               transaction_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Raw material stock updated and transaction recorded
 *       400:
 *         description: Bad request
 *       404:
 *         description: Raw material not found
 */
router.put("/raw-material/:id", authenticate, updateRawMaterialStock);

/**
 * @swagger
 * /api/transaction/finished-good/{id}:
 *   put:
 *     summary: Update finished good units and create transaction
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *               - label
 *             properties:
 *               value:
 *                 type: number
 *               label:
 *                 type: string
 *               transaction_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Finished good units updated and transaction recorded
 *       400:
 *         description: Bad request
 *       404:
 *         description: Finished good not found
 */
router.put("/finished-good/:id", authenticate, updateFinishedGoodUnits);

/**
 * @swagger
 * /api/transaction:
 *   get:
 *     summary: Get all transactions with optional filters
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: model_name
 *         schema:
 *           type: string
 *           enum: [raw_material, finished_good, ledger]
 *       - in: query
 *         name: reference_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: transaction_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get("/", authenticate, getTransactions);

/**
 * @swagger
 * /api/transaction/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction details
 *       404:
 *         description: Transaction not found
 */
router.get("/:id", authenticate, getTransactionById);

export default router;

