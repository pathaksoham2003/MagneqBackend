import express from "express";
import { getFgHistory, getProductionHistory, getRawMaterialHistory } from "../controllers/history.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

// Get Finished Goods History
router.get("/fg", getFgHistory);

// Get Production History
router.get("/production", getProductionHistory);

// Get Raw Material Stock History
router.get("/raw-material", getRawMaterialHistory);

export default router;
