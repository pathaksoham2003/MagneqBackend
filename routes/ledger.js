import express from "express";
import { getLedger } from "../controllers/ledger.js";
import { generateLedgerPDF } from "../controllers/ledger.js";

const router = express.Router();

// POST /ledger
router.post("/", getLedger);

router.get("/pdf", generateLedgerPDF);


export default router;
