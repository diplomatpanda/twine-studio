# Third-party notices

This file records the provenance checks for the bundled story formats and the
production npm package metadata observed in the installed `node_modules` at the
Twine Studio 0.1.0-alpha.1 fork iteration.

## Bundled story formats

The notices below are copied into each matching format directory beside the
bundled artifact. The URLs are the upstream sources used for verification.

| Format | Evidence | Notice |
| --- | --- | --- |
| Chapbook 1.2.3 | [official archive entry](https://videlais.github.io/story-formats-archive/official/index.json) records `LICENSE` and checksum `ba02438bbb6d84bcef2bab40b6c4779bf7b1f4e80c78e16b90389e7fdba6612b`; the same license is present in the upstream [1.2.2 tag](https://raw.githubusercontent.com/klembot/chapbook/1.2.2/LICENSE) | MIT; `public/story-formats/chapbook-1.2.3/LICENSE` |
| Chapbook 2.3.1 | upstream [`2.3.1` package metadata](https://raw.githubusercontent.com/klembot/chapbook/2.3.1/package.json) identifies MIT; notice text from the matching [2.3.1 tag](https://raw.githubusercontent.com/klembot/chapbook/2.3.1/LICENSE) | MIT; `public/story-formats/chapbook-2.3.1/LICENSE` |
| Harlowe 1.2.4, 2.1.0, 3.3.9 | bundled metadata identifies Zlib; the upstream [Harlowe LICENSE](https://github.com/modality/harlowe/blob/master/LICENSE) contains the complete custom Zlib-style notice and identifies Leon Arnott | Custom Zlib-style notice; copied to each Harlowe directory |
| Paperthin 1.0.0 | bundled metadata identifies `ZLib/Libpng`; upstream [package metadata](https://raw.githubusercontent.com/klembot/paperthin/main/package.json) confirms that identifier | No standalone notice was added because an authoritative complete notice text for the historical 1.0.0 artifact was not located. Keep this item in release review. |

The archive index is an integrity/catalog source, not the original authoring
repository. Chapbook 1.2.3 has no Git tag in the upstream repository, so its
license checksum and the identical 1.2.2 license text are recorded explicitly
instead of presenting a direct 1.2.3 tag URL.

## Production npm metadata inventory

The following identifiers were read from installed production dependency
`package.json` files. This is an inventory for follow-up notice generation, not a
complete legal review of dependency trees or embedded assets.

- MIT: `@lukeed/uuid`, `@popperjs/core`, `@tabler/icons`, `classnames`,
  `codemirror`, `detect-it`, `eases`, `file-saver`, `focus-trap-react`,
  `fs-extra`, `i18next`, `i18next-http-backend`, `is-absolute-url`, `lodash`,
  `minimist`, `mkdir-promise`, `node-fetch`, `react`, `react-codemirror2`,
  `react-dom`, `react-draggable`, `react-helmet`, `react-hook-thunk-reducer`,
  `react-hotkeys-hook`, `react-i18next`, `react-popper`, `react-router-dom`,
  `react-scrollbar-size`, `react-tabs`, `scroll`, `segseg`, `ua-parser-js`,
  `use-error-boundary`.
- Apache-2.0: `fuse.js`.
- BSD-3-Clause: `react-transition-group`.
- ISC: `semver`.
- W3C: `focus-visible` (review its notice text when assembling a distributable
  notices bundle).
- Unknown package metadata: `jsonp`; inspect its repository/package contents
  before release.

No production dependency reported GPL, AGPL, or another obviously reciprocal
license in its installed top-level package metadata. Transitive packages,
bundled assets, and Electron's runtime notices remain outside this bounded
inventory.
