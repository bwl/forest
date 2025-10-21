# Task: Add Attachments Support for Nodes

## Objective
Allow users to associate external files with nodes during capture and provide commands to manage and view attachments.

## Key Deliverables
- Storage design for attachments (filesystem layout, naming, metadata tracking).
- CLI enhancements (`capture --attach`, `node.attachments`) for adding and listing assets.
- Synchronization rules for backup/export workflows to include attachments.
- Documentation describing attachment management, size limits, and security considerations.
- Tests covering upload, retrieval, and deletion flows.

## Implementation Plan
1. **Design**
   - Decide on attachment storage location (per profile/workspace) and metadata schema in the database.
   - Define limits (max file size, allowed types) and error handling.
2. **Implementation**
   - Extend capture and node commands to accept attachments and record metadata.
   - Implement retrieval/listing commands with formatting options.
   - Handle deduplication and cleanup on node deletion.
3. **Integration**
   - Update export/import pipelines to include attachments.
   - Ensure backups capture attachment files reliably.
4. **Testing**
   - Add unit/integration tests for attachment lifecycle scenarios.
   - Perform manual tests with various file types and sizes.
5. **Documentation**
   - Update docs and help text with guidance on using attachments.

## Dependencies & Risks
- Requires careful disk space management and cleanup policies.
- Security considerations for serving attachments via the API.
