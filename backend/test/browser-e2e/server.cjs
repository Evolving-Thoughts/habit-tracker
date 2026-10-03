const { assertBrowserEnvironment } = require('./environment.cjs');
// Validate before Nest can connect or synchronize a schema. No .env is loaded here.
assertBrowserEnvironment(process.env);
require('../../dist/main.js');
