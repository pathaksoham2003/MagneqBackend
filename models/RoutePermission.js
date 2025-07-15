import mongoose from "../utils/db.js";

const routePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sidebar: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    support: {
      type: [String],
      default: []
    },
    allowed_routes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: false,
  }
);

const RoutePermission = mongoose.model(
  "RoutePermission",
  routePermissionSchema
);

export default RoutePermission;
