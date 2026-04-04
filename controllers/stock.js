import Stock from '../models/Stock.js';
import logger from '../utils/logger.js';

/** Create Stock */
export const createStock = async (req, res, next) => {
  try {
    const stock = await Stock.create(req.body);
    logger.info(`Stock created by ${req.user.user_name}`);
    res.status(201).json(stock);
  } catch (err) {
    next(err);
  }
};

/** Get All Stocks */
export const getAllStocks = async (req, res, next) => {
  try {
    const stocks = await Stock.find().populate('raw_materials');
    res.json(stocks);
  } catch (err) {
    next(err);
  }
};

/** Update Stock by ID */
export const updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedStock = await Stock.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate('raw_materials');

    if (!updatedStock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    logger.info(`Stock updated: ${id} by ${req.user.user_name}`);
    res.json(updatedStock);
  } catch (err) {
    next(err);
  }
};

/** Delete Stock by ID */
export const deleteStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Stock.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    logger.warn(`Stock deleted: ${id} by ${req.user.user_name}`);
    res.json({ message: 'Stock deleted successfully' });
  } catch (err) {
    next(err);
  }
};
