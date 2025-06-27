import mockData from "./rawMaterialsMock.json" assert {type: "json"};
import RawMaterial from "./models/RawMaterials.js";

export const generateRawMaterials = async () => {
  await RawMaterial.insertMany(mockData.data);
};


