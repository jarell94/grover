const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = appJson.expo || config;

  return {
    ...base,
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
