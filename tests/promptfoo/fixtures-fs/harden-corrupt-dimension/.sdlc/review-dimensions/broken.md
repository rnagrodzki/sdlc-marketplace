# broken.md

This dimension file is intentionally missing its YAML frontmatter.
It has no --- delimiter block at the top, which means validateDimensionFile
will return errors for missing required fields (name, description, severity).

This file is used by the harden-prepare pre-flight validation tests (R16).
