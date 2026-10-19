# Twine Studio

An independent, in-development fork of Twine 2.12.1. Not endorsed by the Twine
project. Upstream history, attribution and GPL-3.0 license are retained.

Run `npm ci`, then `npm start` and open the local URL printed by Vite. Run
`npm run build:web` for the standalone `dist/web` browser app and copied Electron
renderer. `npm run serve:web` serves that build on loopback with a health check
for local preview or reverse-proxy hosting. Run `npm run build:electron-main`
for the desktop main process.
`npm run test:ci`, `npm run lint`, and `npm run e2e -- --project=chromium` verify
the application; first install test browsers with `npx playwright install chromium`.

The passage editor adds a plain-language **Add choice** helper for Harlowe 3 and
SugarCube 2. Enter the text your reader sees and an existing or new destination.
The link is appended to your passage; normal source editing remains available.
**Story logic** adds yes/no facts, numeric values and conditional choices for
those formats. See the [writing guide](docs/getting-started-studio.md) for setup
and undo behavior. Other formats retain their source editing workflow.

The desktop passage editor also offers an optional **Repair passage code with AI**
action for Harlowe and SugarCube code. To enable it, set
`TWINE_STUDIO_OPENCODE_GO_KEY` in the desktop process environment before launch
using your own OpenCode Go key. The browser app does not send AI requests. Every
desktop request needs native confirmation, and accepting a reviewed proposal is
an undoable edit. See the [AI boundary and limits](docs/ai-evaluation.md) before
sending story source.

See [release readiness](docs/release-readiness.md), [product plan](docs/product-plan.md),
[compatibility](docs/compatibility-matrix.md), and [provenance](docs/fork-provenance.md).
The original example [The Last Signal](examples/the-last-signal.html) is a playable
three-passage story that can also be imported for editing. Its original prose is
CC0; the embedded Harlowe runtime retains its separate license.

## Upstream Twine documentation and attribution

by Chris Klimas, Lorenzo Ancora, Leon Arnott, Daithi O Crualaoich, Ingrid Cheung,
Thomas Michael Edwards, Micah Fitch, Juhana Leinonen, Michael Savich, and Ross Smith

### SYNOPSIS

This is a port of Twine to a browser and Electron app. See
[twinery.org](https://twinery.org) for more info.

The story formats in minified format under `story-formats/` exist in separate
repositories:

-   [Harlowe](https://foss.heptapod.net/games/harlowe/)
-   [Paperthin](https://github.com/klembot/paperthin)
-   [Snowman](https://github.com/klembot/snowman)
-   [SugarCube](https://github.com/tmedwards/sugarcube-2)

#### BUILDS

Binary packages for Twine are available on the
[Releases](https://github.com/klembot/twinejs/releases) tab for Windows, MacOS
and Linux. Community-created builds exist on other platforms, such as the Snap
Store or Arch User Repository. As always, only install from sources you trust.

### Development

Run `npm ci` at the top level to install the locked dependencies.

Working with the documentation requires installing
[mdbook](https://rust-lang.github.io/mdBook/), which is not a Node-based
project. You can either install it directly from the project web site or use
your operating system's package manager.

### BUILDING

Run `npm start` to begin serving a development version of Twine locally. This
server will automatically update with changes you make.

Run `npm run start:electron` to run a development version of Twine Studio. It
uses the fork's own profile and Documents folders. For a disposable verification
profile, build web and Electron first, then run `node scripts/verify-desktop.cjs`.

To create a release, run `npm run build`. Finished files will be found under
`dist/`. In order to build Windows apps on macOS or Linux, you will need to have
[Wine](https://www.winehq.org/) and [makensis](http://nsis.sourceforge.net/)
installed. Packaging has not yet been accepted for public release. The fork does
not use upstream Twine's application update feed.

The build process looks for these environment variables when notarizing a macOS
build:

- `APPLE_APP_ID`: The app ID to use. The convention is `country.company.appname`.
- `APPLE_ID`: User name of the Apple account to use for notarization.
- `APPLE_ID_PASSWORD`: App-specific password for the Apple account to use for
  notarization.
- `APPLE_TEAM_ID`: ID of the Apple team account to use for notarization.

If any of these environment variables are not set, the build process will skip
notarizing. This means users will need to right-click the application and open
it manually.

You must have the full Xcode app installed to notarize the app, not just the
Xcode command line tools.

`npm test` will test the source code respectively.

`npm run clean` will delete existing files in `electron-build/` and `dist/`.
