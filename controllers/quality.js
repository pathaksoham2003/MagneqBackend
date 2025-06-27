import Quality from '../models/Quality.js';

/** Create Quality Issue */
export const createQuality = async (req, res) => {
  try {
    const quality = await Quality.create(req.body);
    res.status(201).json(quality);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create quality issue', details: err.message });
  }
};

/** Get All Quality Issues */
export const getAllQualities = async (req, res) => {
  try {
    const qualityList = await Quality.find();
    res.json(qualityList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quality issues' });
  }
};

/** Update Quality Issue by _id */
export const updateQuality = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Quality.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ error: 'Quality issue not found' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quality issue' });
  }
};

/** Delete Quality Issue by _id */
export const deleteQuality = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Quality.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Quality issue not found' });
    }

    res.json({ message: 'Quality issue deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete quality issue' });
  }
};
