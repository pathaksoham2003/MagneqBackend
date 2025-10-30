import express from 'express';
import { createExport } from '../controllers/export.js';

const router = express.Router();

router.post("/", createExport)

export default router;