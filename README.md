# Install GStreamer GitHub Action

This action installs GStreamer by leveraging the release binaries for a specific version found here:

```
https://gstreamer.freedesktop.org/data/pkg/
```

Supported runner environments are Windows and macOS.

## Inputs

### `version`

The version of GStreamer to install.  The default is 1.18.4.

### `arch`

The architecture (`x86` or `x86_64`) of binaries to install.

## Outputs

### `gstreamerPath`

The installation path.

## Example Usage

In this example, it is a Windows environmnent and we want to set the `GSTREAMER_...` environment variables in a follow-on step.  The first step runs the installation.  The second step echos the toutput variables from the previous step into variables that are then redirected into the `GITHUB_ENV` variable.  If a next job were specified, it would have those variables set.

```
- name: Setup GStreamer
  id:   setup_gstreamer
  uses: blinemedical/setup-gstreamer@1.0
  with:
    version: '1.19.90'
    arch: 'x86'
- run: |
    chcp 65001 #set code page to utf-8
    echo ("GSTREAMER_1_0_ROOT_MSVC_X86=${{ steps.setup_gstreamer.outputs.gstreamerPath }}") >> $env:GITHUB_ENV
- run: |
    echo $env:GSTREAMER_1_0_ROOT_MSVC_X86
```

See the `.github/workflows/test.yml` for other examples.

-------------
**References:**
 * [Custom Actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)
 * [Action Toolkit](https://github.com/actions/toolkit)
 