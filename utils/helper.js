export const validateFieldsByClass = (class_type, data) => {
  const requiredFields = {
    A: ['other_specification', 'quantity', 'casting_product'],
    B: ['product', 'quantity', 'status'],
    C: ['other_specification', 'quantity', 'select_items', 'expiry_date'],
  };

  const missingFields = requiredFields[class_type]?.filter(
    (field) => data[field] === undefined || data[field] === null
  );

  return missingFields;
};

export const filterFieldsByClass = (class_type, data) => {
  const allowedFields = {
    A: ['_id', 'class_type', 'other_specification', 'quantity', 'casting_product'],
    B: ['_id', 'class_type', 'product', 'quantity', 'status'],
    C: ['_id', 'class_type', 'other_specification', 'quantity', 'select_items', 'expiry_date'],
  };

  const keepFields = allowedFields[class_type] || [];

  const filtered = {};
  for (const key of keepFields) {
    if (data[key] !== undefined) {
      filtered[key] = data[key];
    }
  }

  return filtered;
};
