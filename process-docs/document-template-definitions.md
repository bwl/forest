# Document Template Definitions

This document provides concrete specifications for core Forest document templates.

## Template Schema

Each template is defined with:

```typescript
interface DocumentTemplate {
  id: string;                    // Unique template identifier
  name: string;                  // Human-readable name
  description: string;           // Purpose and use cases
  version: string;               // Semantic version
  chunks: ChunkDefinition[];     // Ordered chunk specifications
  metadata?: MetadataField[];    // Custom metadata fields
  constraints?: TemplateConstraint[];
}

interface ChunkDefinition {
  id: string;                    // Unique within template (e.g., "abstract")
  label: string;                 // Display name (e.g., "Abstract")
  required: boolean;             // Must be present?
  cardinality: 'single' | 'multiple';  // How many instances allowed?
  order?: number;                // Suggested ordering (0-indexed)
  maxTokens?: number;            // Recommended token limit
  minTokens?: number;            // Minimum token count
  prompt?: string;               // Helper text for users
  placeholder?: string;          // Default content template
  validate?: ValidationRule[];   // Custom validation rules
}

interface MetadataField {
  key: string;                   // Field name (e.g., "author", "date")
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  default?: any;
}
```

## Core Templates

### 1. Research Paper

**Use case**: Academic papers, technical reports, whitepapers

```yaml
id: research-paper
name: Research Paper
version: 1.0.0
description: Academic research paper with standard IMRaD structure

chunks:
  - id: title
    label: Title
    required: true
    cardinality: single
    maxTokens: 50
    prompt: "Concise, descriptive title of your research"

  - id: abstract
    label: Abstract
    required: true
    cardinality: single
    maxTokens: 300
    minTokens: 100
    prompt: "Brief summary of research question, methods, and findings"
    placeholder: |
      Background: ...
      Objective: ...
      Methods: ...
      Results: ...
      Conclusion: ...

  - id: introduction
    label: Introduction
    required: true
    cardinality: single
    maxTokens: 2000
    prompt: "Context, motivation, and research questions"

  - id: literature-review
    label: Literature Review
    required: false
    cardinality: single
    maxTokens: 3000
    prompt: "Survey of related work and theoretical background"

  - id: methodology
    label: Methodology
    required: true
    cardinality: single
    maxTokens: 2500
    prompt: "Research design, data collection, and analysis methods"

  - id: results
    label: Results
    required: true
    cardinality: multiple
    maxTokens: 2000
    prompt: "Findings from your research (can have multiple sections)"

  - id: discussion
    label: Discussion
    required: true
    cardinality: single
    maxTokens: 2000
    prompt: "Interpretation of results, limitations, and implications"

  - id: conclusion
    label: Conclusion
    required: true
    cardinality: single
    maxTokens: 1000
    prompt: "Summary of key findings and future work"

  - id: references
    label: References
    required: true
    cardinality: single
    prompt: "Cited works in standard format"

metadata:
  - key: authors
    type: array
    required: true
  - key: institution
    type: string
    required: false
  - key: publication-date
    type: date
    required: false
  - key: doi
    type: string
    required: false
  - key: keywords
    type: array
    required: false
```

### 2. Meeting Notes

**Use case**: Team meetings, standups, retrospectives, planning sessions

```yaml
id: meeting-notes
name: Meeting Notes
version: 1.0.0
description: Structured notes for meetings with agenda, discussion, and action items

chunks:
  - id: metadata-header
    label: Meeting Metadata
    required: true
    cardinality: single
    maxTokens: 200
    prompt: "Date, time, attendees, and meeting type"
    placeholder: |
      Date: YYYY-MM-DD
      Time: HH:MM - HH:MM
      Attendees: Alice, Bob, Charlie
      Meeting Type: Weekly Standup

  - id: agenda
    label: Agenda
    required: false
    cardinality: single
    maxTokens: 500
    prompt: "Topics to be discussed"
    placeholder: |
      1. Project updates
      2. Blockers and challenges
      3. Next week planning

  - id: discussion
    label: Discussion Notes
    required: true
    cardinality: multiple
    maxTokens: 1500
    prompt: "Main discussion points and decisions (can split by topic)"

  - id: decisions
    label: Decisions Made
    required: false
    cardinality: single
    maxTokens: 800
    prompt: "Key decisions and rationale"

  - id: action-items
    label: Action Items
    required: true
    cardinality: single
    maxTokens: 1000
    prompt: "Actionable tasks with owners and deadlines"
    placeholder: |
      - [ ] Task description (Owner: @alice, Due: 2025-10-30)
      - [ ] Another task (Owner: @bob, Due: 2025-11-01)

  - id: parking-lot
    label: Parking Lot
    required: false
    cardinality: single
    maxTokens: 500
    prompt: "Topics deferred to future meetings"

metadata:
  - key: meeting-type
    type: string
    required: true
    default: "general"
  - key: project
    type: string
    required: false
  - key: next-meeting-date
    type: date
    required: false
```

### 3. Project Specification

**Use case**: Feature specs, PRDs, technical design documents

```yaml
id: project-spec
name: Project Specification
version: 1.0.0
description: Technical specification for projects, features, or system designs

chunks:
  - id: overview
    label: Overview
    required: true
    cardinality: single
    maxTokens: 500
    prompt: "High-level summary of the project"
    placeholder: |
      **Problem**: What problem are we solving?
      **Solution**: What are we building?
      **Impact**: Who benefits and how?

  - id: objectives
    label: Objectives & Goals
    required: true
    cardinality: single
    maxTokens: 800
    prompt: "Measurable objectives and success criteria"

  - id: requirements
    label: Requirements
    required: true
    cardinality: single
    maxTokens: 2000
    prompt: "Functional and non-functional requirements"
    placeholder: |
      ## Functional Requirements
      - FR1: ...
      - FR2: ...

      ## Non-Functional Requirements
      - NFR1: Performance - ...
      - NFR2: Security - ...

  - id: technical-design
    label: Technical Design
    required: true
    cardinality: multiple
    maxTokens: 2500
    prompt: "Architecture, components, data models, APIs (can split into sections)"

  - id: implementation-plan
    label: Implementation Plan
    required: false
    cardinality: single
    maxTokens: 1500
    prompt: "Phased rollout, milestones, dependencies"

  - id: testing-strategy
    label: Testing Strategy
    required: false
    cardinality: single
    maxTokens: 1000
    prompt: "Test plan, acceptance criteria, quality gates"

  - id: risks-mitigations
    label: Risks & Mitigations
    required: false
    cardinality: single
    maxTokens: 1000
    prompt: "Potential risks and mitigation strategies"

  - id: open-questions
    label: Open Questions
    required: false
    cardinality: single
    maxTokens: 800
    prompt: "Unresolved decisions and areas needing clarification"

metadata:
  - key: owner
    type: string
    required: true
  - key: status
    type: string
    required: true
    default: "draft"
  - key: target-date
    type: date
    required: false
  - key: stakeholders
    type: array
    required: false
```

### 4. Blog Post

**Use case**: Blog articles, tutorials, opinion pieces

```yaml
id: blog-post
name: Blog Post
version: 1.0.0
description: Blog article with introduction, body, and conclusion

chunks:
  - id: title
    label: Title
    required: true
    cardinality: single
    maxTokens: 100
    prompt: "Catchy, SEO-friendly title"

  - id: summary
    label: Summary/Lead
    required: true
    cardinality: single
    maxTokens: 200
    prompt: "Hook and preview of the post"

  - id: introduction
    label: Introduction
    required: true
    cardinality: single
    maxTokens: 500
    prompt: "Context and what readers will learn"

  - id: body
    label: Body Section
    required: true
    cardinality: multiple
    maxTokens: 2000
    prompt: "Main content (can split into multiple sections)"

  - id: conclusion
    label: Conclusion
    required: true
    cardinality: single
    maxTokens: 500
    prompt: "Summary and call-to-action"

  - id: references
    label: References/Further Reading
    required: false
    cardinality: single
    maxTokens: 500
    prompt: "Links and resources mentioned in post"

metadata:
  - key: author
    type: string
    required: true
  - key: publish-date
    type: date
    required: false
  - key: tags
    type: array
    required: false
  - key: category
    type: string
    required: false
  - key: featured-image
    type: string
    required: false
```

### 5. Interview Notes

**Use case**: Job interviews, user interviews, research interviews

```yaml
id: interview-notes
name: Interview Notes
version: 1.0.0
description: Structured notes from interviews with candidates or subjects

chunks:
  - id: interviewee-info
    label: Interviewee Information
    required: true
    cardinality: single
    maxTokens: 300
    prompt: "Name, role, background, contact info"
    placeholder: |
      Name: ...
      Role: ...
      Company: ...
      Date: YYYY-MM-DD
      Interviewer(s): ...

  - id: context
    label: Context & Objectives
    required: true
    cardinality: single
    maxTokens: 500
    prompt: "Purpose of interview and key questions"

  - id: questions-answers
    label: Questions & Answers
    required: true
    cardinality: multiple
    maxTokens: 2000
    prompt: "Q&A pairs (can split by topic area)"
    placeholder: |
      **Q: [Question]**
      A: [Answer and notes]

  - id: observations
    label: Observations & Impressions
    required: false
    cardinality: single
    maxTokens: 1000
    prompt: "Behavioral observations, communication style, red flags"

  - id: key-insights
    label: Key Insights
    required: true
    cardinality: single
    maxTokens: 800
    prompt: "Main takeaways and notable quotes"

  - id: next-steps
    label: Next Steps
    required: false
    cardinality: single
    maxTokens: 500
    prompt: "Follow-up actions, decision timeline"

metadata:
  - key: interview-type
    type: string
    required: true
  - key: position
    type: string
    required: false
  - key: rating
    type: number
    required: false
  - key: recommendation
    type: string
    required: false
```

## Usage Examples

### Creating from Template

```bash
# Import with template
forest import paper.md --template research-paper

# Capture with template
forest capture --template meeting-notes --stdin < notes.txt

# Interactive template selection
forest capture --interactive
> Select template: [1] Research Paper, [2] Meeting Notes, ...
```

### Validation

```bash
# Validate document against template
forest validate <doc-id>
> ✓ All required chunks present
> ⚠ Warning: 'abstract' exceeds recommended 300 tokens (current: 450)
> ⚠ Warning: 'literature-review' is optional but recommended

# Strict validation
forest validate <doc-id> --strict
> ✗ Error: Missing required chunk 'methodology'
> ✗ Error: Chunk 'results' below minimum 100 tokens
```

### Querying by Chunk Type

```bash
# Search within specific chunk types
forest search "neural networks" --chunk-type methodology

# List all documents of a template type
forest list --template research-paper

# Export specific chunks
forest export json --chunk-type abstract,conclusion
```

### Template Discovery

```bash
# List available templates
forest templates list
> research-paper       Academic research papers (IMRaD structure)
> meeting-notes        Meeting notes with agenda and action items
> project-spec         Technical specifications and design docs
> blog-post            Blog articles and tutorials
> interview-notes      Interview records and observations

# Show template details
forest templates show research-paper
> [Shows chunk definitions, requirements, metadata fields]

# Create custom template
forest templates create my-template --from research-paper
> [Opens editor with template YAML]
```

## Implementation Notes

1. **Storage**: Templates stored as JSON/YAML files in `src/templates/` directory
2. **Validation**: Implemented as hooks in `importDocumentCore` and document edit workflow
3. **Extensibility**: Users can add custom templates to `~/.config/forest/templates/`
4. **Backward compatibility**: Documents without templates continue using ad hoc chunking
5. **Migration**: Optional command to retroactively apply templates to existing documents

## Future Extensions

- **Template inheritance**: `extends: research-paper` for custom variations
- **Conditional chunks**: "Include 'appendix' if word count > 5000"
- **Inter-chunk validation**: "References must cite sources mentioned in body"
- **AI-assisted filling**: Generate placeholder content based on chunk type
- **Template marketplace**: Community-contributed templates
