const exec = require('@actions/exec');

exports.parseEtcRelease = async () => {
  let osName = null;
  let osVersion = null;

  const options = {
    listeners: {
      stdline: (line) => {
        // Split on = if only one present
        const count = line.match(/=/g);

        if (count && count.length == 1) {
          const kvp = line.split('=');

          if (kvp[0] === 'VERSION_ID' && !osVersion) {
            osVersion = kvp[1].replace(/"/g, '').toString();
          }

          if (kvp[0] === 'NAME' && !osName) {
            osName = kvp[1].replace(/"/g, '').toString();
          }
        }
      },
    },
  };
  await exec.exec('bash', ['-c', 'cat /etc/*-release'], options);
  return {
    name: osName,
    versionId: osVersion,
  };
};

exports.isSelfHosted = () =>
  process.env['AGENT_ISSELFHOSTED'] === '1' ||
  (process.env['AGENT_ISSELFHOSTED'] === undefined &&
    process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted');
