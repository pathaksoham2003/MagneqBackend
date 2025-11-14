import express from "express";
import { getLedger, generateLedgerPDF, getLedgerDateRange, createOpeningBalance } from "../controllers/ledger.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /ledger
router.post("/", getLedger);

router.get("/pdf", generateLedgerPDF);

// GET /ledger/:customerId/date-range
router.get("/:customerId/date-range", getLedgerDateRange);

// POST /ledger/opening-balance
router.post("/opening-balance", authenticate, createOpeningBalance);

export default router;
