const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');

async function cleanup() {
    if (process.platform === 'win32') {
        const msiUrl = core.getInput('msiUrl');

        if (msiUrl) {

            const arch = core.getInput('arch');
            const version = core.getInput('version');
        
            const installers = [
            `gstreamer-1.0-msvc-${arch}-${version}.msi`,
            `gstreamer-1.0-devel-msvc-${arch}-${version}.msi`,
            ];
        
            for (const installer of installers) {
                await exec.exec('msiexec', [
                    '/passive',
                    '/x',
                    installer,
                ]);            
                await io.rmRF(installer);
            }
        }
    }
}

cleanup();