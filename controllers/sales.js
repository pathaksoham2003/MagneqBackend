import Sales from '../models/Sales.js';
import FinishedGoods from '../models/FinishedGoods.js';
import Production from '../models/Production.js';

export const createSale = async (req, res) => {
  try {
    const saleData = { ...req.body, status: "INPROCESS" };

    const sale = new Sales(saleData);
    const savedSale = await sale.save();

    const productionRecords = [];

    for (const item of saleData.finished_goods) {
      const fg = await FinishedGoods.findById(item.finished_good);
      if (!fg) continue;

      const production = new Production({
        order_id: savedSale.order_id,
        finished_good: fg._id,
        quantity: item.quantity,
        status: "UN_PROCESSED", 
        created_at: new Date(),
        updated_at: new Date(),
      });

      await production.save();
      productionRecords.push(production);
    }

    res.status(201).json({
      sale: savedSale,
      productions: productionRecords,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllSales = async (req, res) => {
  try {
    const sales = await Sales.find()
      .populate('finished_goods.raw_material_id')
      .populate('created_by');
    res.status(200).json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getSaleById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate('finished_goods.raw_material_id')
      .populate('created_by');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.status(200).json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSale = async (req, res) => {
  try {
    const updated = await Sales.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate('finished_goods.raw_material_id')
      .populate('created_by');
    if (!updated) return res.status(404).json({ message: 'Sale not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSale = async (req, res) => {
  try {
    const deleted = await Sales.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Sale not found' });
    res.status(200).json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

