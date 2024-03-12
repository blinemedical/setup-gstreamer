const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');
const github = require('@actions/github');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');
const semver = require('semver');
const { parseEtcRelease, isSelfHosted, getWindowsDrive } = require('./utils');

function LinuxDistroConfig(versionIds, envMap, commands) {
  return {
    versionIds: versionIds,
    env: envMap,
    commands: commands,
  };
}

function LinuxDistroCommand(command, args) {
  return { cmd: command, args: args };
}

const combineBuildArgs = (systemArgs, userArgs) =>
  systemArgs
    .filter((systemArg) => !userArgs.some((userArg) => userArg.startsWith(systemArg.split('=')[0])))
    .concat(userArgs);

// Github action runners (shared) currently run in passwordless sudo mode.
const DistroVersionPackageMap = {
  Ubuntu: LinuxDistroConfig(['20.04', '22.04'], {}, [
    LinuxDistroCommand('sudo', ['DEBIAN_FRONTEND=noninteractive', 'apt', 'update']),
    LinuxDistroCommand('sudo', [
      'DEBIAN_FRONTEND=noninteractive',
      'apt',
      'install',
      '-y',
      'build-essential',
      'libglib2.0-dev',
      'libgudev-1.0-dev',
      'libssl-dev',
      'libcairo-dev',
      'libxml2-dev',
      'libjpeg-dev',
      'libmjpegtools-dev',
      'libopenjp2-7-dev',
      'libwxgtk3.0-gtk3-dev',
      'libsoup2.4-dev',
      'libjson-glib-1.0-0',
      'libjson-glib-dev',
      'gcc',
      'pkg-config',
      'git',
      'python3-pip',
      'flex',
      'bison',
    ]),
    LinuxDistroCommand('sudo', ['pip3', 'install', 'meson', 'ninja']),
  ]), // end of linuxdistroconfig
};

async function run() {
  try {
    const baseUrl = 'https://gstreamer.freedesktop.org/data/pkg';
    const version = core.getInput('version');
    const arch = core.getInput('arch');
    const gitUrl = core.getInput('repoUrl');
    const buildSource = core.getBooleanInput('forceBuildFromSource');
    const userBuildArgs = core.getMultilineInput('gstreamerOptions');
    const msiUrl = core.getInput('msiUrl');
    const devMsiUrl = core.getInput('devMsiUrl');
    const buildRun = core.getInput('buildRun');
    let gstreamerPath = '';
    let gstreamerBinPath = '';
    let gstreamerPkgConfigPath = '';

    core.info(`Preparing to install GStreamer version ${version} on ${process.platform}...`);

    // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    core.debug(new Date().toTimeString());

    if (process.platform === 'win32') {
      if (arch != 'x86' && arch != 'x86_64') {
        core.setFailed('"arch" may only be x86 or x86_64');
      }
      const rootDriveLetter = isSelfHosted() ? 'C:' : getWindowsDrive(process.cwd()) + ':';
      if (buildSource) {
        const installDir =
          process.env.GSTREAMER_INSTALL_DIR ?? path.join(rootDriveLetter, `gstreamer\\1.0\\msvc_${arch}`);
        const sourceDir = path.join(rootDriveLetter, 'gstreamer_source');

        core.info("Cloning gstreamer's git repository...");
        await exec.exec('git', ['config', '--global', 'http.postBuffer', '524288000']);
        await exec.exec('git', [
          'clone',
          '--progress',
          '--verbose',
          '--depth',
          '1',
          '--branch',
          version,
          gitUrl,
          sourceDir,
        ]);

        const sourceTarget = { cwd: `${sourceDir}` };
        const windowsBuildArgs = [
          '--buildtype=debugoptimized',
        ];
        const buildArgs = combineBuildArgs(windowsBuildArgs, userBuildArgs);

        await exec.exec(
          'meson',
          [
            'setup',
            '--vsenv',
            `--prefix=${installDir}`,
            ...buildArgs,
            'builddir',
          ],
          sourceTarget
        );
        await exec.exec('meson', ['compile', '-C', 'builddir'], sourceTarget);

        core.info(`Installing gstreamer ${version} to ${installDir}`);
        await exec.exec('meson', ['install', '-C', 'builddir'], sourceTarget);

        await io.rmRF(sourceDir);
        gstreamerPath = installDir;
      } else {
        if (buildRun) {
          const installDir = process.env.GSTREAMER_INSTALL_DIR ?? path.join(rootDriveLetter, `gstreamer\\${buildRun}`)
        } else {
          const installDir =
            process.env.GSTREAMER_INSTALL_DIR ?? path.join(rootDriveLetter, 'gstreamer');
        }

        const installers = [
          `gstreamer-1.0-msvc-${arch}-${version}.msi`,
          `gstreamer-1.0-devel-msvc-${arch}-${version}.msi`,
        ];

        if (msiUrl) {
          core.info(`Downloading: ${msiUrl}`);
          const msiInstallerPath = await tc.downloadTool(msiUrl, installer[0]);

          if (msiInstallerPath) {
            await exec.exec('msiexec', [
              '/passive',
              `INSTALLDIR=${installDir}`,
              'ADDLOCAL=ALL',
              '/i',
              msiInstallerPath,
            ]);
            await io.rmRF(msiInstallerPath);
          } else {
            core.setFailed(`Failed to download ${msiUrl}`);
          }

          core.info(`Downloading: ${devMsiUrl}`);
          const devMsiInstallerPath = await tc.downloadTool(devMsiUrl, installer[1]);

          if (devMsiInstallerPath) {
            await exec.exec('msiexec', [
              '/passive',
              `INSTALLDIR=${installDir}`,
              'ADDLOCAL=ALL',
              '/i',
              devMsiInstallerPath,
            ]);
          } else {
            core.setFailed(`Failed to download ${devMsiUrl}`);
          }
        } else {
          for (const installer of installers) {
            const url = `${baseUrl}/windows/${version}/msvc/${installer}`;

            core.info(`Downloading: ${url}`);
            const installerPath = await tc.downloadTool(url, installer);

            if (installerPath) {
              await exec.exec('msiexec', [
                '/passive',
                `INSTALLDIR=${installDir}`,
                'ADDLOCAL=ALL',
                '/i',
                installerPath,
              ]);
            } else {
              core.setFailed(`Failed to download ${url}`);
            }
          }
        }
        gstreamerPath = path.join(installDir, '1.0', `msvc_${arch}`);
      }

      gstreamerBinPath = path.join(gstreamerPath, 'bin');
      gstreamerPkgConfigPath = path.join(gstreamerPath, 'lib', 'pkgconfig');

      // Set the GSTREAMER_1_0_ROOT_MSVC_<arch> variable
      let gst_root_varname = 'GSTREAMER_1_0_ROOT_MSVC_' + arch.toUpperCase();
      core.info(`Setting ${gst_root_varname} to ${gstreamerPath}`);
      core.exportVariable(gst_root_varname, gstreamerPath);
    } else if (process.platform === 'darwin') {
      if (arch == 'x86') {
        core.setFailed(`GStreamer binaries for ${process.platform} and x86 are not available`);
        return;
      }
      if (buildSource) {
        core.setFailed(`Cannot build from source for ${process.platform}`);
        return;
      }
      let pkgType = arch;
      if (semver.gte(version, '1.19.90')) {
        pkgType = 'universal';
      }
      const installers = [
        `gstreamer-1.0-${version}-${pkgType}.pkg`,
        `gstreamer-1.0-devel-${version}-${pkgType}.pkg`,
      ];

      for (const installer of installers) {
        const url = `${baseUrl}/osx/${version}/${installer}`;

        core.info(`Downloading: ${url}`);
        const installerPath = await tc.downloadTool(url, installer);

        if (installerPath) {
          await exec.exec('sudo', ['installer', '-verbose', '-pkg', installerPath, '-target', '/']);
          await io.rmRF(installerPath);
        } else {
          core.setFailed(`Failed to download ${url}`);
        }
      }

      gstreamerPath = '/Library/Frameworks/GStreamer.framework';
      gstreamerBinPath = `${gstreamerPath}/Commands`;
      gstreamerPkgConfigPath = `${gstreamerPath}/lib/pkgconfig`;
    } else if (process.platform === 'linux') {
      // Determine what flavor of linux is running using exec.  Branch from
      // there to install the necessary package and tool dependencies for
      // developing with gstreamer on that flavor of linux.
      let distro = await parseEtcRelease();

      if (distro.name && distro.versionId) {
        core.info(`Determined: ${distro.name} - ${distro.versionId}`);

        if (distro.name in DistroVersionPackageMap) {
          let config = DistroVersionPackageMap[distro.name];

          if (config.versionIds.includes(distro.versionId)) {
            core.info('Performing pre-req package installation...');

            // Do package installation for the distro config.
            for (const command of config.commands) {
              await exec.exec(command.cmd, command.args, { env: config.env });
            }

            let mesonVersion;
            await exec.exec('meson', ['--version'], {
              listeners: {
                stdline: (line) => {
                  mesonVersion = `meson-${line}`;
                },
              },
            });

            // Come up with a unique key and attempt to fetch the cache under
            // that key.  If not found, clone, configure, build, and cache
            // the result before continuing.
            // NOTE: Increment keyVersion if anything about the caching changes.
            const keyVersion = 1;
            const gstsrc = 'gstreamer_src';
            const prefix = '/usr';
            const opt = { cwd: `${process.cwd()}/${gstsrc}` };
            const key = `${github.context.repo.owner}-${github.context.repo.repo}-${gitUrl}-${version}-${arch}-${distro.name}-${distro.versionId}-${mesonVersion}-${keyVersion}`;
            const cacheKey = await cache.restoreCache([gstsrc], key);

            if (!cacheKey) {
              core.info(`Pre-built not found in cache; creating a new one. (key: "${key}")`);

              // Clone the source tree, configure, compile, and save cache.
              await exec.exec('git', ['config', '--global', 'http.postBuffer', '524288000']);
              await exec.exec('git', [
                'clone',
                '--progress',
                '--verbose',
                '--depth',
                '1',
                '--branch',
                version,
                gitUrl,
                gstsrc,
              ]);

              const linuxBuildArgs = [
                '-Dges=disabled',
                '-Dtests=disabled',
                '-Dexamples=disabled',
                '-Dgst-examples=disabled',
                '-Ddoc=disabled',
                '-Dgtk_doc=disabled',
                '-Dgpl=enabled',
              ];
              const buildArgs = combineBuildArgs(linuxBuildArgs, userBuildArgs);

              await exec.exec(
                'meson',
                [
                  'setup',
                  `--prefix=${prefix}`,
                  ...buildArgs,
                  'builddir',
                ],
                opt
              );
              await exec.exec('meson', ['compile', '-C', 'builddir'], opt);

              await cache.saveCache([gstsrc], key);

              core.info(`New cache created for this key: "${key}"`);
            } else {
              core.info(`Found pre-built cache; using it. (key: "${key}")`);
            }

            // Install (runners are passwordless sudo, presently)
            core.info(`Installing gstreamer ${version} to ${prefix}`);
            await exec.exec('sudo', ['meson', 'install', '-C', 'builddir'], opt);

            gstreamerPath = `${prefix}/lib/${arch}-linux-gnu/gstreamer-1.0`;
            gstreamerBinPath = `${prefix}/bin`;
            gstreamerPkgConfigPath = `${prefix}/lib/${arch}-linux-gnu/pkgconfig`;
          } else {
            core.setFailed(
              `could not find a distro configuration matching ${distro.name}, ${distro.versionId}`
            );
          }
        } else {
          core.setFailed(`unknown distro name "${distro.name}" in available configurations`);
        }
      } else {
        core.setFailed(`could not infer distro from /etc/*-release`);
      }
    } else {
      // Pitch a fit / it's unsupported right now.
      core.setFailed(`${process.platform} is unsupported by this action at this time.`);
    }

    core.debug(new Date().toTimeString());

    // Configure the output(s), add 'bin' to the PATH (via GITHUB_PATH)
    core.setOutput('gstreamerPath', gstreamerPath);
    core.info(`Adding ${gstreamerBinPath} to PATH`);
    core.addPath(gstreamerBinPath);

    core.info(`Adding ${gstreamerPkgConfigPath} to PKG_CONFIG_PATH`);
    let PKG_CONFIG_PATH = process.env.PKG_CONFIG_PATH;
    if (PKG_CONFIG_PATH) {
      PKG_CONFIG_PATH = `${PKG_CONFIG_PATH}:${gstreamerPkgConfigPath}`;
    } else {
      PKG_CONFIG_PATH = gstreamerPkgConfigPath;
    }
    core.exportVariable('PKG_CONFIG_PATH', PKG_CONFIG_PATH);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function cleanup() {
  const arch = core.getInput('arch');
  const version = core.getInput('version');

  const installers = [
    `gstreamer-1.0-msvc-${arch}-${version}.msi`,
    `gstreamer-1.0-devel-msvc-${arch}-${version}.msi`,
  ];

  for (const installer of installers) {
    await exec.exec('msiexec', [
      '/passive',
      '/uninstall',
      installer,
    ]);

    await io.rmRF(installer);
  }
}


if (!!core.getState('isPost')) {
  core.saveState('isPost', 'true')
  run();
} else {
  if (process.platform === 'win32') {
    const msiUrl = core.getInput('msiUrl');
    if (msiUrl) {
      core.info('Post job cleanup.');
      cleanup();
    }
  }
}

