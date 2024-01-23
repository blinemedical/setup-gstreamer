const process = require('process');
const cp = require('child_process');
const path = require('path');

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['INPUT_VERSION'] = '1.22.7';
  process.env['INPUT_ARCH'] = 'x86_64';
  process.env['INPUT_REPOURL'] = 'https://gitlab.freedesktop.org/gstreamer/gstreamer.git';
  process.env['INPUT_GSTREAMEROPTIONS'] = '-Dlibnice:tests=disabled,-Dlibnice:examples=disabled,-Dopenh264:tests=disabled,-Dpygobject:tests=false,-Dpython=enabled,-Dlibav=enabled,-Dugly=enabled,-Dbad=enabled,-Ddevtools=enabled,-Dges=enabled,-Drtsp_server=enabled,-Dvaapi=enabled,-Dsharp=disabled,-Dgpl=enabled,-Dpython=disabled,-Dvaapi=disabled,-Dgst-plugins-base:pango=enabled,-Dgst-plugins-good:cairo=enabled,-Dgst-plugins-good:soup=enabled,-Dgst-plugins-good:soup-lookup-dep=true';
  const ip = path.join(__dirname, 'index.js');
  if (process.platform === 'linux') {
    // Linux uses caching, so until there's a way to mock around @actions/cache,
    // we cannot run this in the test environment because the ACTIONS_ variables
    // are not set and no service is present.  Trying to avoid using the cache
    // API by checking isFeatureAvailable does not prevent the code from crashing
    // when trying to check those variables.
    console.log(`skipping test on ${process.platform}`);
  } else {
    try {
      let result = cp.execSync(`node ${ip}`, { env: process.env }).toString();
      console.log(result);
    } catch (err) {
      console.log('output', err);
      console.log('stderr', err.stderr.toString());
      throw err;
    }
  }
});
