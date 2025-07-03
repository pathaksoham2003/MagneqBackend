import Sales from '../models/Sales.js';
import FinishedGoods from '../models/FinishedGoods.js';
import Production from '../models/Production.js';

export const createSale = async (req, res) => {
  try {
    const saleData = { ...req.body, status: "UN_APPROVED" };

    let totalAmount = 0;
    saleData.finished_goods = saleData.finished_goods.map(item => {
      const rate = parseFloat(item.rate_per_unit || 0);
      const quantity = parseFloat(item.quantity || 0);
      const itemTotal = rate * quantity;

      totalAmount += itemTotal;

      return {
        ...item,
        item_total_price: itemTotal.toFixed(2),
      };
    });

    saleData.total_amount = totalAmount.toFixed(2);

    const sale = new Sales(saleData);
    const savedSale = await sale.save();

    res.status(201).json({ sale: savedSale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const approveSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sales.findById(id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    if (sale.status !== "UN_APPROVED") {
      return res.status(400).json({ error: "Sale is already approved or processed" });
    }

    sale.status = "INPROCESS";
    sale.updated_at = new Date();
    await sale.save();

    const productionRecords = [];

    for (const item of sale.finished_goods) {
      const fg = await FinishedGoods.findById(item.finished_good);
      if (!fg) continue;

      const production = new Production({
        order_id: sale.order_id,
        finished_good: fg._id,
        quantity: item.quantity,
        status: "UN_PROCESSED",
        created_at: new Date(),
        updated_at: new Date(),
      });

      await production.save();
      productionRecords.push(production);
    }

    res.status(200).json({ message: "Sale approved", sale, productions: productionRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getAllSales = async (req, res) => {
  try {
    const sales = await Sales.find()
      .populate('finished_goods.finished_good')
      .populate('created_by');
    res.status(200).json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate('finished_goods.finished_good')
      .populate('created_by');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.status(200).json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSale = async (req, res) => {
  try {
    let updateData = { ...req.body };

    if (updateData.finished_goods) {
      let totalAmount = 0;
      updateData.finished_goods = updateData.finished_goods.map(item => {
        const rate = parseFloat(item.rate_per_unit || 0);
        const quantity = parseFloat(item.quantity || 0);
        const itemTotal = rate * quantity;

        totalAmount += itemTotal;

        return {
          ...item,
          item_total_price: itemTotal.toFixed(2),
        };
      });
      updateData.total_amount = totalAmount.toFixed(2);
    }

    const updated = await Sales.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).populate('finished_goods.finished_good')
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
