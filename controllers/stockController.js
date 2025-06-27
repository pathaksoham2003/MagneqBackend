import Stock from '../models/Stock.js';

/** Create Stock */
export const createStock = async (req, res) => {
  try {
    const stock = await Stock.create(req.body);
    res.status(201).json(stock);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create stock' });
  }
};

/** Get All Stocks */
export const getAllStocks = async (req, res) => {
  try {
    const stocks = await Stock.find().populate('raw_materials');
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
};

/** Update Stock by ID */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedStock = await Stock.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate('raw_materials');

    if (!updatedStock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(updatedStock);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

/** Delete Stock by ID */
export const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Stock.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json({ message: 'Stock deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete stock' });
  }
};
