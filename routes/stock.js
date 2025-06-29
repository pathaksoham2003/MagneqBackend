// import express from 'express';
// import {
//   createStock,
//   getAllStocks,
//   updateStock,
//   deleteStock,
// } from '../controllers/stock.js';

// const router = express.Router();

// /**
//  * @swagger
//  * tags:
//  *   name: Stock
//  *   description: Stock management
//  */

// /**
//  * @swagger
//  * /api/stock:
//  *   post:
//  *     summary: Create a new stock entry
//  *     tags: [Stock]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               raw_materials:
//  *                 type: string
//  *                 description: ID of the raw material
//  *               units:
//  *                 type: number
//  *     responses:
//  *       201:
//  *         description: Stock created successfully
//  *       500:
//  *         description: Failed to create stock
//  */
// router.post('/', createStock);

// /**
//  * @swagger
//  * /api/stock:
//  *   get:
//  *     summary: Get all stocks
//  *     tags: [Stock]
//  *     responses:
//  *       200:
//  *         description: List of all stocks
//  *       500:
//  *         description: Failed to fetch stocks
//  */
// router.get('/', getAllStocks);

// /**
//  * @swagger
//  * /api/stock/{id}:
//  *   put:
//  *     summary: Update a stock by ID
//  *     tags: [Stock]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         description: Stock ID
//  *         schema:
//  *           type: string
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               raw_materials:
//  *                 type: string
//  *               units:
//  *                 type: number
//  *     responses:
//  *       200:
//  *         description: Stock updated successfully
//  *       404:
//  *         description: Stock not found
//  *       500:
//  *         description: Failed to update stock
//  */
// router.put('/:id', updateStock);

// /**
//  * @swagger
//  * /api/stock/{id}:
//  *   delete:
//  *     summary: Delete a stock by ID
//  *     tags: [Stock]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Stock ID
//  *     responses:
//  *       200:
//  *         description: Stock deleted successfully
//  *       404:
//  *         description: Stock not found
//  *       500:
//  *         description: Failed to delete stock
//  */
// router.delete('/:id', deleteStock);

// export default router;
