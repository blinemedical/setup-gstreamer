const process = require('process');
const cp = require('child_process');
const path = require('path');

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['INPUT_VERSION'] = '1.19.90';
  const ip = path.join(__dirname, 'index.js');
  let result = cp.execSync(`node ${ip}`, {env: process.env}).toString();
  console.log(result);
});
