const path = require("node:path");

module.exports = {
  packagerConfig: {
    appBundleId: "com.dakdash.operator",
    appCategoryType: "public.app-category.utilities",
    asar: true,
    executableName: "DakDash",
    extraResource: [path.resolve(__dirname, "backend")],
    extendInfo: {
      LSMinimumSystemVersion: "12.0.0"
    },
    ignore: [
      /^\/backend(?:\/|$)/,
      /^\/out(?:\/|$)/,
      /^\/src(?:\/|$)/,
      /^\/.*\.test\.(?:ts|tsx)$/
    ],
    name: "DakDash"
  },
  makers: []
};
