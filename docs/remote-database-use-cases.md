# Team Collaboration Use Cases

Practical workflows and patterns for using Forest as a shared team knowledge base.

## Setup: Team Forest Instance

### Initial Deployment

```bash
# 1. Deploy PostgreSQL
docker run -d \
  --name forest-db \
  -e POSTGRES_DB=team_knowledge \
  -e POSTGRES_USER=forest \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:15

# 2. Run initial migrations
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://forest:secure_password@localhost:5432/team_knowledge
forest admin:migrate

# 3. Start API server (optional, for GUI/integrations)
forest serve --port 3000 --host 0.0.0.0
```

### Team Member Setup

```bash
# Add to ~/.bashrc or ~/.zshrc
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://forest:password@db.company.internal:5432/team_knowledge
export FOREST_USER=$(git config user.name)
export FOREST_EMAIL=$(git config user.email)

# Verify connection
forest health
```

## Use Case 1: Architecture Decision Records (ADRs)

### Problem
Team makes architectural decisions in Slack threads, email, or verbal discussions. Context gets lost, rationale forgotten, decisions revisited needlessly.

### Forest Workflow

**Step 1: Create ADR Template**

```bash
forest templates create adr
```

```yaml
# ADR Template
id: adr
name: Architecture Decision Record
chunks:
  - id: title
    label: Title
    required: true
  - id: status
    label: Status
    required: true
    placeholder: "Proposed | Accepted | Deprecated | Superseded"
  - id: context
    label: Context
    required: true
    prompt: "What is the issue motivating this decision?"
  - id: decision
    label: Decision
    required: true
    prompt: "What are we going to do?"
  - id: consequences
    label: Consequences
    required: true
    prompt: "What becomes easier or harder because of this decision?"
  - id: alternatives
    label: Alternatives Considered
    required: false
metadata:
  - key: decision-date
    type: date
  - key: stakeholders
    type: array
```

**Step 2: Team Members Capture ADRs**

```bash
# Alice proposes using GraphQL
alice$ forest capture --template adr --stdin <<'EOF'
# Use GraphQL for Public API

## Status
Proposed

## Context
Our REST API is growing complex with nested resources and multiple roundtrips.
Clients (web, mobile) have different data requirements.
Over-fetching wastes bandwidth; under-fetching requires multiple requests.

## Decision
Adopt GraphQL for our public API while maintaining REST for internal services.
Use Apollo Server with TypeScript schema.

## Consequences
Positive:
- Single endpoint, flexible queries
- Strong typing with schema
- Excellent tooling (GraphQL Playground, Apollo Studio)

Negative:
- Team learning curve
- More complex caching
- Potential for expensive queries

## Alternatives Considered
1. **REST with field filtering** - Still requires multiple endpoints
2. **gRPC** - Not browser-friendly, requires HTTP/2
3. **JSON:API** - Standard but less flexible than GraphQL
EOF

✓ Created node 7fa7acb2: "Use GraphQL for Public API"
✓ Auto-linked to 3 existing nodes:
  - ef3a1029: "API design principles" (Alice, score: 0.78)
  - 9c2b4e15: "REST API v2 retrospective" (Bob, score: 0.72)
  - 1a8f3d42: "Mobile app data requirements" (Charlie, score: 0.68)
```

**Step 3: Team Discussion**

```bash
# Bob reads Alice's proposal
bob$ forest node read @0  # Or: forest node read 7fa7acb2
[Shows ADR content...]

Related decisions:
→ ef3a1029  "API design principles" (Alice)
→ 9c2b4e15  "REST API v2 retrospective" (Bob)

# Bob adds his perspective
bob$ forest capture --template adr --stdin <<'EOF'
# Incremental GraphQL Migration Strategy

## Status
Proposed (depends on ADR: Use GraphQL)

## Context
Alice proposed GraphQL for public API. We need a migration plan that:
- Doesn't break existing REST clients
- Can be rolled out incrementally
- Allows learning/validation before full commitment

## Decision
Run GraphQL and REST in parallel for 6 months:
1. Phase 1: GraphQL for new endpoints only
2. Phase 2: Migrate high-value endpoints
3. Phase 3: Deprecation timeline for REST

## Consequences
[...]
EOF

✓ Auto-linked to Alice's GraphQL ADR (score: 0.92)
```

**Step 4: Decision Accepted**

```bash
# After team discussion, Alice updates status
alice$ forest node edit 7fa7acb2
# [Edit status from "Proposed" to "Accepted"]
# [Add "decision-date: 2025-10-23" to metadata]

# Link to implementation ticket
alice$ forest node link 7fa7acb2 <jira-ticket-node>
```

**Step 5: Future Discovery**

```bash
# 6 months later, Diana explores API decisions
diana$ forest search "API design" --chunk-type decision,context
  Found 8 ADRs:
  - 7fa7acb2: "Use GraphQL for Public API" (Accepted, Alice)
  - 3e4f5g6h: "Incremental GraphQL Migration" (Accepted, Bob)
  - 8i9j0k1l: "API versioning strategy" (Accepted, Charlie)

diana$ forest explore 7fa7acb2 --depth 2
  [Shows graph of related decisions, implementations, retrospectives]
```

### Benefits

- **Context preservation**: Why decisions were made, alternatives considered
- **Automatic discovery**: Related decisions surface via semantic linking
- **Temporal tracking**: See evolution of decisions over time
- **Multi-author**: Everyone's perspective captured and linked
- **Agent-accessible**: AI can query ADR history to inform new decisions

## Use Case 2: Daily Standups / Meeting Notes

### Problem
Standup notes lost in Slack, hard to find what was discussed, action items forgotten.

### Forest Workflow

```bash
# Monday standup
alice$ forest capture --template meeting-notes --stdin <<'EOF'
# Engineering Standup - 2025-10-23

## Attendees
Alice, Bob, Charlie, Diana

## Updates

### Alice
- Completed GraphQL schema design
- Starting Apollo Server integration
- Blocked: Need DB schema review from Bob

### Bob
- Finished database migration for analytics
- Code review needed for PR #342
- Planning to help Alice with schema review

### Charlie
- Mobile app authentication working
- Discovered edge case with token refresh
- Will document findings in Forest

### Diana
- Load testing results: 500 req/s sustained
- Need to discuss caching strategy
- Oncall this week

## Decisions
- GraphQL schema review: Bob + Alice pairing session Tuesday
- Caching strategy: Dedicated meeting Thursday

## Action Items
- [ ] Bob: Review Alice's DB schema (Due: 2025-10-24)
- [ ] Charlie: Document token refresh edge case (Due: 2025-10-25)
- [ ] Diana: Prepare caching strategy proposal (Due: 2025-10-26)
- [ ] Alice: Schedule Thursday caching meeting (Due: today)
EOF

✓ Auto-linked to:
  - "GraphQL ADR" (mentioned in Alice's update)
  - "Database migration plan" (Bob's work)
  - "Authentication implementation" (Charlie's work)
```

**Query Recent Standups**

```bash
# What did we discuss about caching?
$ forest search "caching" --chunk-type discussion,decisions --limit 10

# What were Charlie's action items this sprint?
$ forest search "Charlie" --chunk-type action-items --after 2025-10-15

# Show all standup notes
$ forest list --template meeting-notes --sort created_at
```

**Link Standup to Implementation**

```bash
# Charlie documents the edge case mentioned in standup
charlie$ forest capture --stdin <<'EOF'
# Token Refresh Edge Case: Concurrent Requests

During testing, discovered that concurrent requests during token refresh
can cause race condition...

[Technical details...]
EOF

✓ Auto-linked to:
  - "Engineering Standup 2025-10-23" (mentioned this issue)
  - "Authentication implementation" (related system)

# Manual link to action item
charlie$ forest node link @0 <standup-node-id>
```

## Use Case 3: Incident Post-Mortems

### Problem
Post-mortems written after incidents, but never referenced. Same issues repeat because learnings aren't discoverable.

### Forest Workflow

**Create Post-Mortem Template**

```yaml
id: post-mortem
name: Incident Post-Mortem
chunks:
  - id: summary
    label: Summary
    required: true
  - id: timeline
    label: Timeline
    required: true
  - id: root-cause
    label: Root Cause
    required: true
  - id: impact
    label: Impact
    required: true
  - id: action-items
    label: Action Items
    required: true
  - id: lessons-learned
    label: Lessons Learned
    required: true
metadata:
  - key: incident-date
    type: date
  - key: severity
    type: string
  - key: duration-minutes
    type: number
  - key: owner
    type: string
```

**Document Incident**

```bash
diana$ forest capture --template post-mortem --stdin <<'EOF'
# Database Connection Pool Exhaustion - 2025-10-23

## Summary
Production API became unresponsive due to connection pool exhaustion.
Database queries timed out, causing cascading failures.

## Timeline
- 14:32: First alerts for increased latency
- 14:35: API error rate spiked to 25%
- 14:37: On-call identified connection pool at max (10 connections)
- 14:40: Emergency fix: Increased pool size to 50
- 14:42: Service recovered
- Duration: 10 minutes

## Root Cause
Recent GraphQL endpoint allows arbitrary nested queries.
User triggered deeply nested query that held connections for 30+ seconds.
Connection pool (max: 10) exhausted quickly under normal traffic.

## Impact
- 25% error rate for 10 minutes
- ~500 failed API requests
- 3 customer escalations
- No data loss

## Action Items
- [ ] Implement query complexity limits in GraphQL (Priority: P0, Owner: Alice)
- [ ] Add connection pool monitoring alerts (Priority: P0, Owner: Bob)
- [ ] Increase connection pool to 50 in all environments (Priority: P0, Owner: Diana)
- [ ] Add query timeout (5s) to prevent long-running queries (Priority: P1, Owner: Charlie)
- [ ] Load test GraphQL endpoints (Priority: P1, Owner: Diana)

## Lessons Learned
1. Query complexity must be validated in GraphQL
2. Connection pool size should scale with traffic
3. Need better observability into connection pool utilization
4. Load testing should include pathological query patterns
EOF

✓ Auto-linked to:
  - "GraphQL ADR" (root cause related)
  - "Database migration plan" (connection settings)
  - "Load testing results" (Diana's previous work)
```

**Prevent Future Incidents**

```bash
# 2 weeks later, Bob is implementing a new API feature
bob$ forest search "connection pool" --chunk-type root-cause,lessons-learned

Found in post-mortems:
  - "Database Connection Pool Exhaustion" (Diana)
    → Lesson: Always set query timeouts
    → Lesson: Monitor connection pool utilization

bob$ forest node read <post-mortem-id> --chunk root-cause
[Shows root cause and action items]

# Bob ensures his feature has query limits
# Links his implementation to the post-mortem
bob$ forest node link <his-new-feature> <post-mortem-id>
```

## Use Case 4: Onboarding New Developers

### Problem
New developers don't know where to start, what to read, who to ask.

### Forest Workflow

**Step 1: Create Onboarding Path**

```bash
# Senior dev curates onboarding materials
alice$ forest capture --tags onboarding,getting-started --stdin <<'EOF'
# New Engineer Onboarding Guide

## Welcome!
This guide will help you get up to speed with our systems and processes.

## Week 1: Local Setup
1. Read: "Development environment setup"
2. Read: "Architecture overview"
3. Read: "Code review guidelines"
4. Complete: "Hello World PR" (first contribution)

## Week 2: Domain Knowledge
1. Read all ADRs tagged #architecture
2. Explore: "API design" in Forest
3. Pair: Schedule pairing session with a backend engineer

## Week 3: First Real Task
1. Read recent post-mortems to understand system failures
2. Pick a "good first issue" from backlog
3. Shadow oncall rotation

## Resources
- Forest search: `forest search "getting-started"`
- Team wiki: [legacy link]
- Ask in #engineering-help
EOF

# Link to key documents
alice$ forest node link @0 <architecture-overview-id>
alice$ forest node link @0 <code-review-guidelines-id>
```

**Step 2: New Developer Explores**

```bash
# Eve joins the team
eve$ forest search "onboarding"
  → "New Engineer Onboarding Guide" (Alice)

eve$ forest node read <onboarding-guide-id>
[Reads guide...]

# Explore architecture
eve$ forest search "architecture" --tags architecture
  → "System Architecture Overview" (Alice)
  → "Microservices ADR" (Bob)
  → "Database design" (Charlie)

eve$ forest explore <architecture-overview-id> --depth 2
[Graph shows how systems relate]

# Find answers to common questions
eve$ forest search "deploy" --chunk-type context,decision
  → "Deployment strategy ADR" (Diana)
  → "CI/CD pipeline setup" (Bob)

# See what everyone's working on
eve$ forest stats --top-nodes
  Most connected nodes:
  1. "GraphQL API design" (Alice) - 42 edges
  2. "Authentication system" (Charlie) - 38 edges
  3. "Database schema" (Bob) - 35 edges
```

**Step 3: Eve Contributes**

```bash
# After completing onboarding task
eve$ forest capture --tags onboarding-feedback --stdin <<'EOF'
# Onboarding Experience Notes

## What Worked Well
- Forest made it easy to find documentation
- Automatic links helped discover related systems
- Could see who authored docs and ask them questions

## Suggestions
- "Architecture overview" could link to post-mortems for context
- Would be helpful to have a glossary of team-specific terms
- Template for "First Contribution" writeups
EOF

✓ Auto-linked to "New Engineer Onboarding Guide"
```

## Use Case 5: Cross-Functional Collaboration

### Problem
Engineering, Product, Design work in silos. Decisions made without full context.

### Forest Workflow

**Product Manager's Spec**

```bash
pm$ forest capture --template product-spec --stdin <<'EOF'
# Feature: User Dashboard Redesign

## Problem
Current dashboard has 40% bounce rate. Users can't find key metrics.
Support tickets indicate confusion about layout.

## Solution
Redesign dashboard with:
- Customizable widgets
- Role-based default layouts
- Drag-and-drop rearrangement

## Success Metrics
- Reduce bounce rate to <20%
- Increase time-on-page by 50%
- NPS score increase from 7 to 8

## User Research
[Links to research notes in Forest]

## Timeline
Q4 2025
EOF

✓ Auto-linked to:
  - "User research: Dashboard pain points" (UX)
  - "Analytics tracking implementation" (Engineering)
```

**Designer's Mockups**

```bash
designer$ forest capture --stdin <<'EOF'
# Dashboard Redesign - Design Proposal

[Design rationale, mockups, user flows...]

## Technical Constraints Needed
- Max widget types we can support?
- Performance implications of drag-and-drop?
- State persistence approach?
EOF

✓ Auto-linked to PM's spec

# Link to Figma
designer$ forest node edit @0
# [Add metadata: figma-url: https://figma.com/...]
```

**Engineer's Technical Design**

```bash
engineer$ forest capture --template technical-design --stdin <<'EOF'
# Dashboard Redesign - Technical Implementation

## Architecture
- React Grid Layout for drag-and-drop
- Redux for widget state management
- LocalStorage + backend sync for persistence

## API Endpoints
- GET /api/dashboard/layout
- POST /api/dashboard/layout
- GET /api/widgets/available

## Performance Considerations
- Lazy-load widgets
- Virtualize long lists
- Debounce layout saves

## Questions for Product/Design
- How many widget types? (affects bundle size)
- Mobile layout? (Grid doesn't work well on small screens)
EOF

✓ Auto-linked to:
  - PM's product spec
  - Designer's proposal
  - "API design guidelines" (existing ADR)

# Tag for design to see
engineer$ forest node edit @0
# [Add tags: #needs-product-input, #needs-design-input]
```

**Discovery Across Functions**

```bash
# PM discovers engineering constraints
pm$ forest node read <technical-design-id>
[Sees questions about mobile...]

pm$ forest capture --stdin <<'EOF'
# Dashboard Redesign - Mobile Scope Decision

After reviewing engineering constraints, mobile dashboard will be
phase 2. Desktop first allows us to:
- Ship faster (Q4 timeline intact)
- Validate widget concept
- Learn from usage before mobile implementation

Mobile target: Q1 2026
EOF

# Everyone can query the feature
$ forest search "dashboard redesign"
  Product spec (PM)
  Design proposal (Designer)
  Technical design (Engineer)
  Mobile scope decision (PM)
  → All automatically linked!
```

## Use Case 6: Agent-Assisted Development

### Problem
AI assistants give generic answers. They don't know team's specific context, decisions, codebase patterns.

### Forest Workflow

**Setup: Forest API as Knowledge Source**

```bash
# Start Forest API server
forest serve --port 3000 --host 0.0.0.0

# Make it available to agent
# (e.g., Claude Code, GitHub Copilot, custom agents)
```

**Agent Queries Team Knowledge**

```bash
# Developer asks agent: "How should I implement authentication?"

# Agent queries Forest
curl -X GET 'http://forest-team.internal:3000/api/v1/search?q=authentication+implementation'

{
  "results": [
    {
      "id": "7fa7acb2",
      "title": "Authentication System Design",
      "author": "Charlie",
      "chunk_type": "technical-design",
      "score": 0.92,
      "summary": "OAuth 2.0 with JWT tokens, refresh token rotation..."
    },
    {
      "id": "3e4f5g6h",
      "title": "ADR: Use Auth0 for Authentication",
      "author": "Alice",
      "chunk_type": "decision",
      "score": 0.88
    }
  ]
}

# Agent reads the full context
curl -X GET 'http://forest-team.internal:3000/api/v1/nodes/7fa7acb2'

# Agent provides team-specific answer
Agent: "Based on your team's architecture decision (ADR by Alice),
       you should use Auth0 for authentication. Charlie's implementation
       guide shows the JWT token flow. Here's how to implement it..."
```

**Agent Discovers TLDR Commands**

```bash
# Agent learns Forest capabilities
curl -X GET 'http://forest-team.internal:3000/--tldr=json'

{
  "commands": [
    {"cmd": "capture", "purpose": "Create new note", ...},
    {"cmd": "search", "purpose": "Semantic search", ...},
    ...
  ]
}

# Agent can now help user capture knowledge
Agent: "I can help you save this to your team's Forest. Run:
       echo 'your notes' | forest capture --template adr"
```

**Agent Surfaces Related Knowledge**

```bash
# Developer: "I'm implementing a GraphQL resolver"

# Agent searches Forest
curl -X GET 'http://forest-team.internal:3000/api/v1/search?q=graphql+resolver+patterns'

# Agent finds
- "GraphQL ADR" (context on why GraphQL)
- "GraphQL best practices" (coding patterns)
- "GraphQL incident post-mortem" (what to avoid)

Agent: "I found your team's GraphQL guidelines. They recommend using
       DataLoader for batching. Here's an example from Bob's implementation..."
```

## Best Practices

### 1. Tagging Strategy

```bash
# Use consistent tags
#architecture    - System design decisions
#api            - API-related docs
#database       - Database design, migrations
#security       - Security considerations
#incident       - Post-mortems, outages
#onboarding     - New developer resources
#deprecated     - Superseded decisions

# Combine tags for filtering
forest search "deployment" --tags architecture,security
```

### 2. Template Usage

```bash
# Use templates for consistency
forest capture --template adr          # Architecture decisions
forest capture --template meeting-notes # Standups, planning
forest capture --template post-mortem   # Incidents
forest capture --template technical-design # Engineering specs
forest capture --template product-spec  # Product requirements
```

### 3. Author Attribution

```bash
# Set your identity
export FOREST_USER=$(git config user.name)
export FOREST_EMAIL=$(git config user.email)

# Query by author
forest search "database" --author charlie
forest stats --by-author
```

### 4. Link Related Work

```bash
# Manual linking for clear relationships
forest node link <implementation> <adr>
forest node link <post-mortem> <fix-pr>
forest node link <tech-design> <product-spec>

# Auto-linking handles the rest
forest capture --auto-link ...
```

### 5. Regular Exploration

```bash
# Weekly: See what teammates captured
forest list --after $(date -d '7 days ago' +%Y-%m-%d) --sort updated_at

# Monthly: Review top-connected nodes
forest stats --top-nodes

# Explore before building
forest search "your-topic" --chunk-type decision,root-cause
```

## Team Adoption Checklist

- [ ] Deploy shared PostgreSQL database
- [ ] Configure team members' environments (FOREST_DB_URL, FOREST_USER)
- [ ] Create team-specific templates (ADR, meeting notes, etc.)
- [ ] Establish tagging conventions
- [ ] Import existing documentation (wikis, ADRs, design docs)
- [ ] Train team on Forest basics (capture, search, explore)
- [ ] Set up API server for agent access
- [ ] Create onboarding guide in Forest itself
- [ ] Schedule weekly "Forest gardening" to review/clean/link
- [ ] Measure success metrics (adoption rate, search usage, link density)

---

**Forest transforms team documentation from scattered, stale, and siloed into connected, discoverable, and living knowledge.**
