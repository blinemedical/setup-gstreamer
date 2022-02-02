# Install GStreamer GitHub Action

This action installs GStreamer onto Windows, macOS or Linux by leveraging the release binaries for a specific version.

## Inputs

### `version`

The version of GStreamer to install.  The default is 1.18.4.

## Outputs

### `gstreamerX86Path`

The x86 (32-bit) architecture installation path.

### `gstreamerX64Path`

The x86_64 (64-bit) architecture installation path.

## Example Usage

```
uses: blinemedical/setup-gstreamer@1.0
with:
  version: '1.19.90'
```

-------------
**References:**
 * [Custom Actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)
 * [Action Toolkit](https://github.com/actions/toolkit)
 