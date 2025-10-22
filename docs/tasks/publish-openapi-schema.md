# Task: Publish OpenAPI Schema and SDK Stubs

## Objective
Expose an OpenAPI schema for the `serve` API and provide tooling to generate client SDK stubs.

## Key Deliverables
- Specification of API endpoints, request/response models, and authentication requirements.
- Automated generation of `/openapi.json` served by the API (`serve --openapi`).
- CLI or script to regenerate OpenAPI spec during builds.
- Documentation guiding users on accessing the schema and generating SDKs.
- Tests validating schema completeness and compatibility with clients.

## Implementation Plan
1. **API Inventory**
   - Document existing endpoints, parameters, and payloads.
2. **Schema Design**
   - Define OpenAPI components and ensure models cover current and planned functionality.
   - Plan versioning strategy for schema updates.
3. **Implementation**
   - Integrate schema generation into the codebase (using decorators or manual definitions).
   - Add CLI flag `serve --openapi` to expose schema and optional UI (Swagger/Redoc).
4. **Testing**
   - Validate schema using OpenAPI linters and integration tests.
5. **Documentation**
   - Update docs with instructions for consuming the schema and generating SDK stubs.

## Dependencies & Risks
- Requires accurate modeling of all endpoints; gaps may surface missing docs.
- Must align with security features to ensure schema reflects auth requirements.
