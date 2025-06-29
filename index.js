import express from 'express';
import mongoose from "./utils/db.js"
import cors from 'cors';
import dotenv from 'dotenv';

import './models/User.js';
import './models/RawMaterials.js';
import './models/Sales.js';
import './models/Production.js';
import './models/Stock.js';
import './models/FinishedGoods.js';
import './models/Purchase.js';
import './models/Quality.js';

import swaggerUI from 'swagger-ui-express';
import swaggerSpec from './swagger/swagger.js';

import userRouter from "./routes/user.js";
import rawMaterialRoutes from './routes/rawMaterials.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import qualityRoutes from './routes/quality.js';
import finishedGoodsRoutes from './routes/finishedGoods.js';
import salesRoutes from './routes/sales.js';
import productionRoutes from './routes/production.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => res.send('ERP Server Running...'));

app.use('/api', userRouter);
app.use('/api/raw_material', rawMaterialRoutes);
app.use('/api/purchase_order', purchaseOrderRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/finished_goods', finishedGoodsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/production', productionRoutes);

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});