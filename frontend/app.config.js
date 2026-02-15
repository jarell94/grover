const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = appJson.expo || config;
  const requiredPlugins = [
    '@react-native-community/datetimepicker',
    'expo-font',
    'expo-web-browser',
  ];
  const existingPlugins = base.plugins || [];
  const pluginNames = new Set(
    existingPlugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
  );
  const mergedPlugins = [...existingPlugins];
  requiredPlugins.forEach((plugin) => {
    if (!pluginNames.has(plugin)) {
      mergedPlugins.push(plugin);
      pluginNames.add(plugin);
    }
  });

  return {
    ...base,
    plugins: mergedPlugins,
    newArchEnabled: true,
    android: {
      ...base.android,
      gradleProperties: {
        ...(base.android?.gradleProperties || {}),
        newArchEnabled: 'true',
      },
    },
  };
};
