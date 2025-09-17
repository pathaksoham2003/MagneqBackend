import express from "express";
import {
  createDelivery,
  updateDelivery,
  getAllDeliveries,
  getDeliveryById,
} from "../controllers/delivery.js";

const router = express.Router();

router.post("/", createDelivery);          // create delivery
router.put("/:id", updateDelivery);        // update delivery info
router.get("/", getAllDeliveries);         // list deliveries
router.get("/:id", getDeliveryById);

export default router;
