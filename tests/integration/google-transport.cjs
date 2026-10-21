// Test-process preload: control only Google's external HTTPS transport. The
// application keeps its normal provider configuration and real OAuth checks.
const https = require('node:https');
const http = require('node:http');
const original = https.request;
https.request = function (input, options, callback) {
  const url = new URL(input);
  if (['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'].includes(url.hostname)) {
    const target = new URL(url.pathname + url.search, process.env.TEST_GOOGLE_ORIGIN);
    return http.request(target, options, callback);
  }
  return original.call(this, input, options, callback);
};
