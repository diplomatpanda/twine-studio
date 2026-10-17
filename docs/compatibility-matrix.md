# Compatibility evidence

Preserved upstream import/export/publishing code and native format bundles.
Parser acceptance alone is not a runtime compatibility claim.

| Format | Bundled versions | Visual choice generation | Runtime evidence |
| --- | --- | --- | --- |
| Harlowe | 1.2.4, 2.1.0, 3.3.9 | Major 3 only | 3.3.9 generated-link export and ending pass in enhanced/basic editors |
| SugarCube | 1.0.35, 2.37.3 | Major 2 only | 2.37.3 generated-link export and ending pass in enhanced editor |
| Chapbook | 1.2.3, 2.3.1 | Source editing | Broader runtime/round-trip checks pending |
| Snowman | 1.5.0, 2.1.4 | Source editing | Broader runtime/round-trip checks pending |
| Paperthin | 1.0.0 | Proofing only | Historical license notice unresolved |
| Custom | User-installed | Source editing | No blanket compatibility claim |

The helper emits only plain links and conservatively rejects special syntax in
labels/destination names. It never converts or parses existing macros. Direct
source editing preserves advanced names, scripts and format-specific behavior.
Visual conditions/state operations are not yet implemented.

Native IDs, IFIDs, tags, positions, sizes, start passage, format/version, scripts,
styles and existing export formats retain upstream handling. Comprehensive
advanced-story and cross-format round trips remain release gates.
