import FinishedGoods from '../models/FinishedGoods.js';

export const createFinishedGood = async (req, res) => {
  try {
    const newFG = new FinishedGoods(req.body);
    const savedFG = await newFG.save();
    res.status(201).json(savedFG);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllFinishedGoods = async (req, res) => {
  try {
    const finishedGoods = await FinishedGoods.find()
      .populate('raw_materials.raw_material_id');
    res.status(200).json(finishedGoods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFinishedGoodById = async (req, res) => {
  try {
    const fg = await FinishedGoods.findById(req.params.id)
      .populate('raw_materials.raw_material_id');
    if (!fg) {
      return res.status(404).json({ message: 'Finished good not found' });
    }
    res.status(200).json(fg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFinishedGood = async (req, res) => {
  try {
    const updatedFG = await FinishedGoods.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('raw_materials.raw_material_id');
    if (!updatedFG) {
      return res.status(404).json({ message: 'Finished good not found' });
    }
    res.status(200).json(updatedFG);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteFinishedGood = async (req, res) => {
  try {
    const deletedFG = await FinishedGoods.findByIdAndDelete(req.params.id);
    if (!deletedFG) {
      return res.status(404).json({ message: 'Finished good not found' });
    }
    res.status(200).json({ message: 'Finished good deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getModelConfig = async (req, res) => {
  try {
    const finishedGoods = await FinishedGoods.aggregate([
      {
        $group: {
          _id: {
            model: "$model",
            power: { $toString: "$power" }, 
            ratio: "$ratio",
          },
        },
      },
      {
        $group: {
          _id: "$_id.model",
          powers: { $addToSet: "$_id.power" },
          power_ratios: {
            $push: {
              power: "$_id.power",
              ratio: "$_id.ratio",
            },
          },
        },
      },
    ]);

    // Transform result to desired shape
    const config = {};
    for (const fg of finishedGoods) {
      const model = fg._id;
      config[model] = {
        powers: fg.powers.map(Number).sort((a, b) => a - b),
        ratios: {},
      };

      for (const pr of fg.power_ratios) {
        const powerKey = pr.power;
        if (!config[model].ratios[powerKey]) {
          config[model].ratios[powerKey] = [];
        }
        if (!config[model].ratios[powerKey].includes(pr.ratio)) {
          config[model].ratios[powerKey].push(pr.ratio);
        }
      }
    }

    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch model config" });
  }
};
