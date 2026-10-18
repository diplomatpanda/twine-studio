# Twine Studio fork provenance

Twine Studio is a distinct application fork based on Twine 2.12.1 at baseline
commit `4ebcce6a69c62b1c4b51bb76f2b7ac51dd84d9d2` (tag `2.12.1`). The upstream
project and author attribution remain recorded in `package.json` and the
repository history.

Story-format editor extensions negotiate against the inherited Twine 2.12.1 API
contract, independently of Studio's product version. This does not change the
fork's displayed identity or the creator/version metadata in published stories.

## License inventory

The application source is identified as GPL-3.0 by `package.json` and the root
`LICENSE` file. The bundled story formats are separately authored artifacts and
retain their own notices where present:

- Snowman 1.5.0 and 2.1.4: MIT notices in their `LICENSE` files.
- SugarCube 1.0.35: Simplified BSD notice in its `LICENSE` file.
- SugarCube 2.37.3: BSD-2-Clause notice in its `LICENSE` file.
- Harlowe format metadata identifies Zlib; Paperthin metadata identifies
  ZLib/Libpng; Snowman 2.1.4 metadata identifies MIT; SugarCube metadata
  identifies its BSD variants.

The baseline lacked standalone notices for Chapbook, Harlowe and Paperthin.
Verified Chapbook and Harlowe notices have since been added; see
[third-party-notices.md](third-party-notices.md) for sources and remaining
Paperthin uncertainty. This is not a claim that all transitive or embedded
notices have been independently verified.

## Data isolation

The fork uses the distinct Electron application identity `org.twine.studio` and
the display name Twine Studio. Its default Documents folders are therefore
named `Twine Studio/Stories`, `Twine Studio/Backups`, and `Twine Studio/Scratch`.
Electron preferences are stored under the fork's own `userData` directory. No
migration or import of existing Twine preferences, story formats, stories,
backups, or scratch files is performed by this iteration.

Browser persistence uses distinct `twine-studio-*` keys. Legacy `twine-*` keys
are left untouched; no automatic migration runs. To bring an existing story
across, publish/archive it from Twine and import that HTML in Twine Studio.
This namespace is a data ownership boundary, not a security boundary against
scripts executing on the same origin. Authored browser previews and format
metadata now use isolated frames; approved format extensions still have renderer
authority. See preview-isolation.md and story-format-trust.md.
