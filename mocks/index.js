import mongoose from "../utils/db.js";
import fs from "fs";
import bcrypt from "bcrypt";

import RawMaterial from "../models/RawMaterials.js";
import User from "../models/User.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RoutePermission from "../models/RoutePermission.js";
import { insertFinishedGoods } from "./fg.js";

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

      const { permissions, role } = user;

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

const runSeeder = async () => {
  try {
    const rawMaterials = await generateRawMaterials(); // This must be done before FG insertion
    await insertFinishedGoods(); // Uses raw materials inserted above
    await seedUsers();
  } catch (err) {
    console.error("❌ Seeder failed:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

runSeeder();
