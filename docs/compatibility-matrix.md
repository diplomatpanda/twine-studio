# Compatibility evidence

Preserved upstream import/export/publishing code and native format bundles.
Parser acceptance alone is not a runtime compatibility claim.

| Format | Bundled versions | Visual choice generation | Runtime evidence |
| --- | --- | --- | --- |
| Harlowe | 1.2.4, 2.1.0, 3.3.9 | Major 3 only | 3.3.9 links, clue/score conditions and independent endings; native-source/script/CSS round trip |
| SugarCube | 1.0.35, 2.37.3 | Major 2 only | 2.37.3 links, clue/score conditions and independent endings; native-source/script/CSS round trip; four-passage custom-macro/StoryInit/CSS fixture survives import, unrelated edit and published navigation in three browser engines |
| Chapbook | 1.2.3, 2.3.1 | Source editing | 2.3.1 variable interpolation, script/CSS and edit/export round trip |
| Snowman | 1.5.0, 2.1.4 | Source editing | 2.1.4 template expression, script/CSS and edit/export round trip |
| Paperthin | 1.0.0 | Proofing only | Historical license notice unresolved |
| Custom | User-installed | Source editing | Isolated metadata and untrusted publication; approved direct and hydrated editor extensions in bounded fixtures |

The choice helper emits plain links and conservatively rejects special syntax
in labels/destination names. Story logic adds native yes/no or numeric assignments,
signed numeric changes, conditional choices and short conditional text for Harlowe 3
and SugarCube 2. Neither helper converts or parses existing macros. Initialization
and consistent fact types are explicit author responsibilities. Direct source
editing remains available.

Native IDs, IFIDs, tags, positions, sizes, start passage, format/version, scripts,
styles and existing export formats retain upstream handling. Comprehensive
advanced-story and cross-format round trips remain release gates.

The current round-trip fixtures are synthetic. The stronger SugarCube fixture
exercises one custom macro and branch after import/edit/export, but it does not
establish preservation of representative third-party projects, every custom
macro or plugin, external assets, or old format versions. No visual logic support
is claimed for Chapbook or Snowman.

Editor extensions target the inherited Twine 2.12.1 API independently of Studio's
product version. Bundled Harlowe formatting and explicit custom-code approval
have browser regression coverage. Custom editor-code approval requires a readable
source snapshot and SHA-256; publishing can use isolated legacy JSONP hosts.
See story-format-trust.md for custom wrapper and revocation limits.
