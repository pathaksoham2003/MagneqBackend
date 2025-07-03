import mongoose from "../utils/db.js";
import fs from "fs";
import bcrypt from "bcrypt";

import RawMaterial from "../models/RawMaterials.js";
import User from "../models/User.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RoutePermission from "../models/RoutePermission.js";

const mockData = JSON.parse(
  fs.readFileSync(new URL("./rawMaterials.json", import.meta.url), "utf-8")
);

const generateRawMaterials = async () => {
  await RawMaterial.deleteMany({});
  const inserted = await RawMaterial.insertMany(mockData.data);
  console.log("✅ Raw materials seeded successfully");
  return inserted;
};

const seedUsers = async () => {
  try {
    const users = JSON.parse(
      fs.readFileSync(new URL("./users.json", import.meta.url), "utf-8")
    );

    const routePermissionsMap = {};

    for (let user of users) {
      if (!user.password.startsWith("$2b$")) {
        user.password = await bcrypt.hash(user.password, 10);
      }

      const {permissions, role} = user;

      if (permissions && role) {
        if (!routePermissionsMap[role]) {
          routePermissionsMap[role] = permissions;
        }
      }

      delete user.permissions;
    }

    await User.deleteMany({});
    await User.insertMany(users);
    console.log("✅ Users seeded successfully");

    await RoutePermission.deleteMany({});
    const permissionsToInsert = Object.entries(routePermissionsMap).map(
      ([role, perms]) => ({
        role,
        sidebar: perms.sidebar || [],
        support: perms.support || [],
        allowed_routes: perms.allowed_routes || [],
      })
    );

    await RoutePermission.insertMany(permissionsToInsert);
    console.log("✅ Route permissions seeded successfully");
  } catch (err) {
    console.error("❌ Error seeding users and permissions:", err.message);
  }
};

const generateFinishedGoods = async (rawMaterials) => {
  await FinishedGoods.deleteMany({});

  const classA = rawMaterials.find((rm) => rm.class_type === "A");
  const classB = rawMaterials.find(
    (rm) => rm.class_type === "B" && rm.type === "PROCESSED"
  );
  const classC = rawMaterials.find((rm) => rm.class_type === "C");

  if (!classA || !classB || !classC) {
    console.error(
      "❌ Could not find required raw materials: class A, processed class B, and class C"
    );
    return;
  }

  const finishedGoodsData = [
    {
      model: "M1",
      type: "Type-A",
      ratio: "5:1",
      other_specification: {power_rating: "10kW", material_grade: "ISO 898"},
      units: 0,
      raw_materials: [
        {raw_material_id: classA._id, quantity: 2},
        {raw_material_id: classB._id, quantity: 3},
        {raw_material_id: classC._id, quantity: 1},
      ],
    },
    {
      model: "M2",
      type: "Type-B",
      ratio: "10:1",
      other_specification: {torque: "30Nm"},
      units: 0,
      raw_materials: [
        {raw_material_id: classA._id, quantity: 1},
        {raw_material_id: classB._id, quantity: 2},
      ],
    },
  ];

  await FinishedGoods.insertMany(finishedGoodsData);
  console.log("✅ Finished goods seeded successfully");
};

const runSeeder = async () => {
  try {
    const rawMaterials = await generateRawMaterials();
    await seedUsers();
    await generateFinishedGoods(rawMaterials);
  } catch (err) {
    console.error("❌ Seeder failed:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

runSeeder();
