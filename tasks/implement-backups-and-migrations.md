# Task: Implement Backups and Migration Tooling

## Objective
Provide first-class backup and migration capabilities, including rolling snapshots, versioned migrations, and dry-run options.

## Key Deliverables
- Backup command specification supporting incremental/rolling snapshots and selective exports.
- Migration framework with versioning, dry-run, and rollback capabilities (`admin.migrate`).
- Storage strategy for backups (local filesystem, optional remote targets).
- Documentation covering backup schedules, restoration procedures, and migration workflows.
- Tests verifying backup integrity and migration safety.

## Implementation Plan
1. **Design**
   - Define backup formats (compressed archive, JSON + attachments) and retention policies.
   - Outline migration versioning scheme and metadata tracking.
2. **Implementation**
   - Build CLI commands for creating, listing, restoring backups.
   - Implement migration runner with dry-run reporting and logging.
3. **Integration**
   - Ensure other features (attachments, profiles) integrate with backup/migration system.
4. **Testing**
   - Create automated tests to validate backup/restore cycles and migration edge cases.
5. **Documentation**
   - Publish step-by-step guides and best practices for administrators.

## Dependencies & Risks
- Requires coordination with attachment storage to ensure completeness.
- Must handle large datasets efficiently and safely.
