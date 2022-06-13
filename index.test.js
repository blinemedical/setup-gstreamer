const process = require('process');
const cp = require('child_process');
const path = require('path');

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['INPUT_VERSION'] = '1.19.90';
  process.env['INPUT_ARCH'] = 'x86_64';
  const ip = path.join(__dirname, 'index.js');
  try {
    let result = cp.execSync(`node ${ip}`, {env: process.env}).toString();
    console.log(result);
  } catch (err) {
    console.error(err.stdout.toString());
    throw err;
  }
});
