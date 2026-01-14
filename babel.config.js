module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Plugin per react-native-reanimated
      'react-native-reanimated/plugin',

      // Plugin per leggere le variabili dal .env
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,      // se vuoi far fallire il build se manca una variabile, metti true
        allowUndefined: true,
      }],
    ],
  };
};
