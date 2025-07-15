// Example A Type product creation body 
const a = {
  "class_type": "A",
  "quantity": 150,
  "other_specification": {
    "material": "Steel",
    "grade": "SS304",
    "color": "Silver"
  },
  "name": "Casting Wheel"
}

// Example B Type product creation body 
const b = {
  "class_type": "B",
  "quantity": 80,
  "name": "Raw Gear",
  "status": "Available"
}

// Example C Type product creation body
const c = {
  "class_type": "C",
  "quantity": 200,
  "other_specification": {
    "hardness": "65 HRC",
    "usage": "Die casting"
  },
  "select_items": [
    {
      "item_code": "S001",
      "weight": "10kg"
    },
    {
      "item_code": "S002",
      "description": "Reusable component"
    }
  ],
  "expiry_date": "2025-12-31"
}
