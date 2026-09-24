# Setup Pulse CLI

Install [Pulse](https://pulse.premex.se)'s command-line build measurement client in GitHub Actions. Works with any Pulse organization and compatible self-hosted Pulse server. No Premex account, Go installation, or private repository access is needed to install the CLI.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: premex-ab/setup-pulse@v1
    with:
      version: '0.4.0-rc.2'
  - name: Measure a build
    run: pulse run --name build --output pulse-build.json -- make build
```

Pin the action to a full commit SHA for immutable installation behavior. The `version` input accepts exact versions listed in [releases.json](releases.json); it never resolves `latest` or downloads arbitrary versions. Action and CLI versions are independent.

## Report to your Pulse server

Installation requires no token. Uploads require credentials for **your** Pulse server and organization:

```yaml
- name: Measure and upload
  env:
    PULSE_SERVER_URL: https://pulse.example.com
    PULSE_ORG: your-organization
    PULSE_API_TOKEN: ${{ secrets.PULSE_API_TOKEN }}
  run: >-
    pulse run --name build --project your-project --upload
    --output pulse-build.json -- make build
```

The action only installs the CLI. It does not run your build, configure a build cache, or send telemetry. `pulse run` supports ordinary commands; `--tool xcode --result-bundle path.xcresult` additionally imports detailed Xcode activity. Xcode collection requires macOS and Xcode 16.3+. Other platforms can record generic commands.

The CLI preserves the wrapped command's exit status and reports measurement/upload failures separately. Save `--output` artifacts for diagnostics if uploads fail. For Xcode, the command must create a fresh result bundle at the same path supplied to Pulse.

## Inputs and outputs

| Name | Kind | Description |
| --- | --- | --- |
| `version` | Input | Exact CLI version; default `0.4.0-rc.2`. |
| `version` | Output | Installed CLI version. |
| `path` | Output | Absolute path to the installed executable. |

The executable is added to `PATH` for subsequent steps. Supported targets: Linux, macOS and Windows, each on AMD64 and ARM64. Use a current GitHub Actions runner supporting Node.js 24 actions.

## Verification and releases

Downloads come from this public repository's `cli-vVERSION` release assets. SHA-256 digests are committed in the action's manifest and checked **before** the executable is made available. Installation rejects unsupported versions/platforms, failed downloads and checksum mismatches. It does not execute the downloaded binary during installation.

CLI `0.4.0-rc.2` is a preview of cross-tool command measurement and Xcode execution timelines. Its source revision and compiler version are recorded in `releases.json` and the CLI release's `build-info.json`. CLI binaries are built from the separate Pulse repository; this repository contains the installer, tests and public binary distribution. The preview is intended for evaluation, and the matching Pulse server execution-model support is required for the timeline UI.

To add a CLI release, publish the six platform binaries with `SHA256SUMS`, build information and third-party notices, review their hashes into `releases.json`, then run the test matrix before tagging a new action release. Never replace existing release assets. `v1` follows compatible action releases; full SHA pins remain unchanged.

Run installer tests with `node --test test/*.test.mjs`. CI also uses the action to download the real release and run a measured subprocess on Linux, macOS and Windows.

The MIT license covers this action's source code. CLI binaries include third-party notices in their release assets.
