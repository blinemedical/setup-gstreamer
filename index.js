const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');
const semver = require('semver');

async function run() {
  try {
    const baseUrl = "https://gstreamer.freedesktop.org/data/pkg";
    const version = core.getInput('version');
    const arch = core.getInput('arch');
    let gstreamerPath = '';
    let gstreamerBinPath = '';

    if (arch != 'x86' && arch != 'x86_64') {
      core.setFailed('"arch" may only be x86 or x86_64');
    }

    core.info(`Preparing to install GStreamer version ${version} on ${process.platform}...`);

    // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    core.debug((new Date()).toTimeString());

    if (process.platform === 'win32') {
      const installers = [
        `gstreamer-1.0-msvc-${arch}-${version}.msi`,
        `gstreamer-1.0-devel-msvc-${arch}-${version}.msi`
      ];
      
      for (const installer of installers) {
        const url = `${baseUrl}/windows/${version}/msvc/${installer}`;

        core.info(`Downloading: ${url}`);
        const installerPath = await tc.downloadTool(url, installer);
        await exec.exec('msiexec', ['/package', installerPath, '/quiet', 'ADDLOCAL=ALL']);
        await io.rmRF(installerPath);
      }

      gstreamerPath = `c:\\gstreamer\\1.0\\msvc_${arch}`;
      gstreamerBinPath = `${gstreamerPath}\\bin`;

      // Set the GSTREAMER_1_0_ROOT_MSVC_<arch> variable
      let gst_root_varname = 'GSTREAMER_1_0_ROOT_MSVC_' + arch.toUpperCase();
      core.info(`Setting environment variable: ${gst_root_varname}`);
      core.exportVariable(gst_root_varname, gstreamerPath);
    }
    else if (process.platform === 'darwin') {
      if (arch == 'x86') {
        core.setFailed(`GStreamer binaries for ${process.platform} and x86 are not available`);
      }
      let pkgType = arch;
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

      gstreamerPath = '/Library/Frameworks/GStreamer.framework';
      gstreamerBinPath = `${gstreamerPath}/Commands`;
    }
    else {
      // Pitch a fit / it's unsupported right now.
      core.setFailed(`${process.platform} is unsupported by this action at this time.`);
    }

    core.info((new Date()).toTimeString());

    // Configure the output(s), add 'bin' to the PATH (via GITHUB_PATH)
    core.setOutput('gstreamerPath', gstreamerPath);
    core.addPath(gstreamerBinPath);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
