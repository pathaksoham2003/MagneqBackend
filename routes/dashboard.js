// routes/dashboard.js
import express from "express";
import {
  getTopStats,
  getSalesTable,
  getSalesStatistics,
} from "../controllers/dashboard.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Real-time dashboard metrics
 */

/**
 * @swagger
 * /api/dashboard/top-stats:
 *   get:
 *     summary: Get top statistics
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard top statistics fetched
 */
router.get("/top-stats", getTopStats);

/**
 * @swagger
 * /api/dashboard/sales-table:
 *   get:
 *     summary: Get latest sales table
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Sales table data fetched
 */
router.get("/sales-table", getSalesTable);

/**
 * @swagger
 * /api/dashboard/statistics:
 *   get:
 *     summary: Get monthly sales & revenue statistics
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Sales statistics data fetched
 */
router.get("/statistics", getSalesStatistics);

export default router;