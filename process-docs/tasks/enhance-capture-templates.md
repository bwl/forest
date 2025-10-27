# Task: Enhance Capture Templates and Quick Capture UX

## Objective
Expand the capture experience with templates, tag appends, frontmatter ingestion, and editor-based workflows to streamline structured note entry.

## Key Deliverables
- Template definition format (YAML/JSON) and storage location.
- CLI enhancements for `capture --template`, `--tags+`, `--from frontmatter`, and `--edit` (editor launch).
- Documentation covering template creation, tag appends, and editor usage.
- Tests ensuring template fields populate correctly and new flags interoperate with existing options.

## Implementation Plan
1. **Research & Design**
   - Evaluate template formats and decide on configuration approach (global vs profile-specific templates).
   - Define UX for tag append vs overwrite and frontmatter parsing.
2. **Implementation**
   - Extend capture command parser to support new flags and editor invocation.
   - Implement template loading, placeholder substitution, and validation.
   - Integrate frontmatter parsing for input files when requested.
3. **Testing**
   - Add unit tests for template resolution, tag merging, and editor launching.
   - Perform manual capture sessions to validate end-to-end flows.
4. **Documentation**
   - Update CLI help and write how-to guides for building templates and using new flags.

## Dependencies & Risks
- Editor support must respect cross-platform considerations (`$EDITOR`, fallback behavior).
- Need to guard against destructive overwrites when combining tags and templates.
