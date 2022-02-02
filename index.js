const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');
const semver = require('semver');

async function run() {
  try {
    const baseUrl = "https://gstreamer.freedesktop.org/data/pkg";
    const version = core.getInput('version');
    let x86Path = '';
    let x64Path = '';

    core.info(`Preparing to install GStreamer version ${version} on ${process.platform}...`);

    // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    core.debug((new Date()).toTimeString());

    if (process.platform === 'win32') {
      const installers = [
        `gstreamer-1.0-msvc-x86-${version}.msi`,
        `gstreamer-1.0-devel-msvc-x86-${version}.msi`,
        `gstreamer-1.0-msvc-x86_64-${version}.msi`,
        `gstreamer-1.0-devel-msvc-x86_64-${version}.msi`
      ];
      
      for (const installer of installers) {
        const url = `${baseUrl}/windows/${version}/msvc/${installer}`;

        core.info(`Downloading: ${url}`);
        const installerPath = await tc.downloadTool(url, installer);
        await exec.exec('msiexec', ['/package', installerPath, '/quiet', 'ADDLOCAL=ALL']);
        await io.rmRF(installerPath);
      }

      x86Path = 'c:\\gstreamer\\1.0\\msvc_x86';
      x64Path = 'c:\\gstreamer\\1.0\\msvc_x86_64';
    }
    else if (process.platform === 'darwin') {
      let pkgType = 'x86_64';
      if (semver.gte(version, '1.19.90')) {
        pkgType = 'universal';
      }
      const installers = [
        `gstreamer-1.0-${version}-${pkgType}.pkg`,
        `gstreamer-1.0-devel-${version}-${pkgType}.pkg`
      ];

      for (const installer of installers) {
        const url = `${baseUrl}/osx/${version}/${installer}`;

        core.info(`Downloading: ${url}`);
        const installerPath = await tc.downloadTool(url, installer);
        await exec.exec('sudo', ['installer', '-verbose', '-pkg', installerPath, '-target', '/']);
        await io.rmRF(installerPath);
      }

      x86Path = '';
      x64Path = '/Library/Frameworks/GStreamer.framework';
    }
    else {
      // Pitch a fit / it's unsupported right now.
      core.error(`${process.platform} is unsupported by this action at this time.`);
    }

    core.info((new Date()).toTimeString());

    // Configure the output(s)
    core.setOutput('gstreamerX86Path', x86Path);
    core.setOutput('gstreamerX64Path', x64Path);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
