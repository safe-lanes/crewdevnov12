const path = require("node:path");
const dotenv = require("dotenv");
const staticConfig = require("./app.json");

// Local builds use the repository-root .env requested for this project. EAS
// cloud builds supply the same public values through its named production
// environment; the ignored .env file is never uploaded as a credential store.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

module.exports = () => {
  const projectId = process.env.EXPO_PROJECT_ID;
  return {
    ...staticConfig.expo,
    extra: {
      ...(staticConfig.expo.extra || {}),
      ...(projectId ? { eas: { ...(staticConfig.expo.extra?.eas || {}), projectId } } : {}),
    },
  };
};
