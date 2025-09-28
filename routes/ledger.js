import express from "express";
import { getLedger } from "../controllers/ledger.js";

const router = express.Router();

// POST /ledger
router.post("/", getLedger);

export default router;
