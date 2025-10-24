# Example: Complex Business Workflow - Home Water Filtration Client

**Domain**: Home services / Water filtration systems
**Scenario**: New client inquiry requiring proposal preparation
**Demonstrates**: Knowledge retrieval, context synthesis, multi-step execution

---

## User Request

```bash
crown "New client inquiry: John Smith in Wantagh, Long Island needs a whole home water filtration system. Prepare a proposal report."
```

---

## Step 1: Intent Parsing

### intent-parser (Claude Haiku - 150ms)

**Input**: Natural language request
**Output**: Structured intent

```json
{
  "action": "execute",
  "entity": "task",
  "template": "prepare_proposal",
  "vars": {
    "client_name": "John Smith",
    "location": "Wantagh, Long Island",
    "service_type": "whole_home_water_filtration",
    "deliverable": "proposal_report"
  },
  "modifiers": {
    "include": ["context", "similar"]
  }
}
```

---

## Step 2: Forest Context Discovery

### forest-query-engine (Claude Sonnet - 800ms)

**Queries Executed**:

```typescript
// Query 1: Similar past projects
forest.search(
  "#project #water-filtration #long-island #completed",
  { limit: 10, minScore: 0.65 }
)

// Query 2: Location-specific knowledge
forest.search(
  "Wantagh Long Island water quality regulations permits",
  { limit: 5 }
)

// Query 3: Product catalog
forest.search(
  "#product #whole-home-system #active",
  { limit: 20 }
)

// Query 4: Pricing models
forest.search(
  "#pricing #water-filtration #residential",
  { limit: 5 }
)
```

**Context Retrieved** (from forest-graph):

### Related Projects (3 found via embeddings)

**Node ID: PRJ-2847** (Similarity: 0.89)
```markdown
# Project: Whole Home Filtration - Massapequa, NY

**Client**: Sarah Chen
**Location**: Massapequa, Nassau County, Long Island
**Completed**: 2024-08-15
**System**: WholeGuard Pro 5000

## Water Test Results
- Hardness: 18 GPG (very hard)
- Chlorine: 4.2 ppm
- Iron: 0.8 ppm
- pH: 7.8

## Solution Installed
- Multi-stage filtration system
- Water softener (60,000 grain capacity)
- Whole-house carbon filter
- UV sterilization unit

## Pricing
- Equipment: $4,850
- Installation: $2,200
- Permits: $175
- Total: $7,225

## Outcome
Client reported 95% satisfaction. Follow-up at 6 months showed
excellent water quality. Minor adjustment needed to softener
regeneration cycle.

## Notes
Long Island water is notoriously hard. Nassau County requires
backflow prevention permits. Installation took 2 days (crawl
space access was challenging).
```

**Node ID: PRJ-3104** (Similarity: 0.82)
```markdown
# Project: Whole Home System - Hicksville, NY

**Client**: Michael Torres
**Location**: Hicksville, Nassau County
**Completed**: 2024-09-22
**System**: AquaPure Complete Home

## Challenge
Client had well water with high sulfur content ("rotten egg smell").

## Solution
- Whole-house sediment filter
- Air injection oxidation system (for sulfur)
- Carbon filtration
- Water softener

## Pricing
- Equipment: $6,200
- Installation: $2,800
- Well water testing: $350
- Total: $9,350

## Lessons Learned
Well water systems need more extensive testing. Budget extra time
for specialized equipment. Client appreciated the detailed water
analysis report we provided upfront.
```

**Node ID: KNW-0834** (Similarity: 0.76)
```markdown
# Long Island Water Quality Overview

## Regional Characteristics
Long Island water comes from underground aquifers. Common issues:
- High hardness (12-20 GPG typical)
- Elevated chlorine (municipal treatment)
- Some areas: iron, manganese
- South shore: occasional salt intrusion (coastal areas)

## Regulatory Environment
- Nassau County: Requires plumbing permits for whole-home systems
- Suffolk County: Backflow prevention mandatory
- NYC DEP oversees some watersheds
- All installations require licensed plumber

## Seasonal Considerations
- Winter: Frozen ground complicates outdoor work
- Summer: High demand = longer lead times
- Best installation season: Spring/Fall

## Local Suppliers
- Preferred vendor: Island Water Solutions (Farmingdale)
- Backup: AquaTech Distributors (Ronkonkoma)
```

### Product Catalog (Top 3 matches)

**Node ID: PROD-1205**
```markdown
# WholeGuard Pro 5000

**Category**: Whole Home Filtration System
**Manufacturer**: PureFlow Systems
**Cost**: $4,850 (dealer)
**Retail**: $7,200

## Specifications
- Flow rate: 15 GPM
- Capacity: 1,000,000 gallons
- Stages: 5 (sediment, carbon, KDF, coconut shell carbon, post-filter)
- Dimensions: 48" H x 10" D
- Warranty: 10 years

## Ideal For
- 3-5 bedroom homes
- Municipal water supplies
- Hardness up to 20 GPG (with softener add-on)

## Installation Notes
- Requires 220V electrical (for UV option)
- 1.5" plumbing recommended
- Indoor installation required
- Floor space: 4 sq ft

## Customer Satisfaction
4.7/5 stars (128 installs)
```

**Node ID: PROD-1289**
```markdown
# AquaPure Complete Home

**Category**: Premium Whole Home System
**Cost**: $6,200 (dealer)
**Retail**: $9,500

## Specifications
- Flow rate: 20 GPM
- Multi-tank design (sediment + carbon + softener integrated)
- Smart monitoring (Wi-Fi enabled)
- Warranty: Lifetime on tanks, 5 years electronics

## Ideal For
- Larger homes (5+ bedrooms)
- Well water systems
- High iron/sulfur content
- Tech-savvy clients who want app monitoring

## Premium Features
- Mobile app with filter life monitoring
- Automatic regeneration scheduling
- Low-salt indicator
- Water usage analytics
```

### Pricing Model (1 template found)

**Node ID: TMPL-0456**
```markdown
# Residential Whole Home Filtration Pricing Template

## Base Package Calculation
```
Equipment Cost (system + softener + filters) × 1.5 = Base Price

Example:
- System: $4,850
- Softener: $1,200
- UV (optional): $800
- Total Equipment: $6,850
- Base Price: $6,850 × 1.5 = $10,275
```

## Installation Labor
- Standard (1 day): $1,500
- Complex (2 days, crawl space): $2,200
- Well system integration: +$800

## Additional Costs
- Water testing: $200-$500
- Permits: $150-$300 (varies by county)
- Backflow preventer: $350
- Electrical (if needed): $400-$800

## Financing Options
- 12 months 0% APR
- 24 months 4.9% APR
- 60 months 7.9% APR

## Typical All-In Range
- Basic municipal water: $7,000 - $9,000
- Premium municipal: $10,000 - $13,000
- Well water system: $9,000 - $15,000
```

---

## Step 3: Session Opens

### session-ledger

```
Session ID: sess-a8f2
Intent: prepare_proposal for John Smith (Wantagh, Long Island)
Actor: sales-team
Status: open
```

**Event 0**: `session_opened`

---

## Step 4: Issue & Task Creation

### workflow-orchestrator creates nodes in forest-graph

**Issue Node: ISS-5432**
```json
{
  "id": "ISS-5432",
  "title": "Proposal: John Smith - Whole Home Water Filtration (Wantagh, LI)",
  "body": "# Client Inquiry\n\n**Name**: John Smith...",
  "tags": [
    "issue",
    "state:ready",
    "client-inquiry",
    "water-filtration",
    "long-island",
    "priority:p2"
  ],
  "metadata": {
    "client_name": "John Smith",
    "location": "Wantagh, Long Island",
    "service_type": "whole_home_water_filtration",
    "inquiry_date": "2025-10-24",
    "assigned_to": "sales-team"
  }
}
```

**Task Node: TSK-4521**
```json
{
  "id": "TSK-4521",
  "title": "Prepare proposal report for ISS-5432",
  "tags": [
    "task",
    "state:pending",
    "template:prepare_proposal",
    "deliverable:report"
  ],
  "metadata": {
    "template": "prepare_proposal",
    "issue_id": "ISS-5432",
    "vars": {
      "client_name": "John Smith",
      "location": "Wantagh, Long Island"
    }
  }
}
```

**Forest Edge**: `TSK-4521 --executes--> ISS-5432`

**Event 1**: `node_created` (ISS-5432)
**Event 2**: `node_created` (TSK-4521)
**Event 3**: `edge_created` (executes relationship)

---

## Step 5: Task Execution

### task-dispatcher selects runner

**Selected**: `runner.proposal-generator`

**Event 4**: `runner_selected` (runner.proposal-generator)

### task-executor runs proposal generation

**Runner Type**: Document synthesis agent (GPT-4 with retrieval)

**Execution Steps**:

1. **Synthesize Context** (AI analyzes Forest context)
   ```
   Input:
   - Similar projects: PRJ-2847, PRJ-3104
   - Location knowledge: KNW-0834
   - Products: PROD-1205, PROD-1289
   - Pricing: TMPL-0456

   Task: Generate customized proposal for John Smith in Wantagh
   ```

2. **Generate Proposal Document**

**Output** (`artifacts/proposal-john-smith-wantagh-20251024.pdf`):

---

## Generated Proposal (Excerpt)

```markdown
# Water Filtration Proposal
## John Smith Residence - Wantagh, Long Island

**Prepared By**: Island Pure Water Solutions
**Date**: October 24, 2025
**Valid Through**: November 24, 2025

---

### Executive Summary

Thank you for your interest in improving your home's water quality.
Based on typical water conditions in Wantagh and our extensive
experience with whole-home systems throughout Nassau County, we
recommend a comprehensive multi-stage filtration solution.

---

### Local Water Quality Context

Wantagh, located in Nassau County on Long Island's South Shore,
receives water from underground aquifers. Based on our experience
with 15+ installations in your area, typical water characteristics
include:

- **Hardness**: 14-18 GPG (grains per gallon) - classified as "hard" to "very hard"
- **Chlorine**: 3-5 ppm (parts per million) due to municipal treatment
- **pH**: 7.5-8.0 (slightly alkaline)
- **Occasional**: Trace iron, manganese in some neighborhoods

**Our Recommendation**: We suggest starting with a professional water
test (included in this proposal) to confirm your specific water
chemistry before finalizing system specifications.

---

### Recommended System: WholeGuard Pro 5000 Package

Based on similar homes in your area, we recommend:

**Primary System**: WholeGuard Pro 5000
- 5-stage filtration (sediment, activated carbon, KDF media, coconut shell carbon, post-filter)
- 15 GPM flow rate (supports 3-4 bathrooms simultaneously)
- 1,000,000 gallon capacity
- 10-year manufacturer warranty

**Add-On Components**:
1. **Water Softener** (60,000 grain capacity)
   - Addresses Long Island's hard water
   - Reduces scale buildup in pipes and appliances
   - Improves soap efficiency and skin/hair feel

2. **UV Sterilization Unit** (Optional but recommended)
   - Provides additional protection against bacteria
   - Especially valuable given coastal location
   - No chemicals, zero maintenance

3. **Backflow Prevention Valve**
   - Required by Nassau County code
   - Protects municipal water supply
   - Included in installation

---

### Similar Project: Success Story from Massapequa (8 miles away)

In August 2024, we installed an identical system for the Chen
residence in Massapequa (also Nassau County). Their water tested at:
- Hardness: 18 GPG
- Chlorine: 4.2 ppm
- Iron: 0.8 ppm

**Results after 6 months**:
- 95% client satisfaction rating
- Dramatically improved water taste and clarity
- Eliminated hard water staining
- Reduced detergent usage by ~40%
- Minor adjustment to softener cycle (handled during included 6-month service)

> "We wish we had done this years ago. The difference in water quality
> is remarkable - coffee tastes better, no more spots on dishes, and my
> skin feels so much softer after showers." - Sarah Chen, Homeowner

---

### Installation Process

**Timeline**: 2 days

**Day 1** (6-8 hours):
- Main water line cutoff
- System installation in basement/utility area
- Plumbing connections (1.5" recommended)
- Electrical hookup for UV unit (220V)
- Initial testing

**Day 2** (4-6 hours):
- Water softener configuration
- System calibration
- Water quality testing
- Client training on maintenance
- Final inspection

**Special Considerations for Your Home**:
- Our team will assess basement/crawl space access
- We'll coordinate Nassau County permit (included in price)
- Licensed plumber and electrician on-site

---

### Investment Breakdown

| Item | Description | Cost |
|------|-------------|------|
| **Equipment** | | |
| WholeGuard Pro 5000 | Main filtration system | $4,850 |
| Water Softener | 60,000 grain capacity | $1,200 |
| UV Sterilization | Optional upgrade | $800 |
| Backflow Preventer | Required by county | $350 |
| **Subtotal Equipment** | | **$7,200** |
| | | |
| **Professional Services** | | |
| Water Testing | Comprehensive 12-point test | $300 |
| Installation Labor | 2-day install, 2 technicians | $2,200 |
| Permits & Inspections | Nassau County plumbing permit | $175 |
| **Subtotal Services** | | **$2,675** |
| | | |
| **TOTAL INVESTMENT** | | **$9,875** |

**Includes**:
- Free in-home water quality consultation
- Professional installation by licensed plumber
- All permits and county inspections
- 6-month follow-up service visit
- 10-year equipment warranty
- 2-year labor warranty

---

### Financing Options

**Option 1**: 12 months, 0% APR
- Monthly payment: $823/month
- Total paid: $9,875

**Option 2**: 24 months, 4.9% APR
- Monthly payment: $433/month
- Total paid: $10,392

**Option 3**: 60 months, 7.9% APR
- Monthly payment: $201/month
- Total paid: $12,060

*Subject to credit approval through GreenSky®*

---

### Why Choose Island Pure Water Solutions?

- **Local Expertise**: 78 successful installations across Nassau County
- **Long Island Specialists**: We understand regional water challenges
- **Licensed & Insured**: NYS Licensed Plumber #123456
- **A+ BBB Rating**: 4.8/5 stars (156 reviews)
- **Manufacturer Certified**: WholeGuard Pro authorized installer
- **Same-Day Service**: For maintenance and warranty issues

---

### Next Steps

1. **Schedule Free Water Test**: We'll send a technician to collect samples
2. **Review Test Results**: 3-5 business days for lab analysis
3. **Finalize System Specs**: Adjust recommendations based on your specific water
4. **Schedule Installation**: Typical lead time: 2-3 weeks
5. **Enjoy Pure Water**: Lifetime of better water quality

---

### Questions?

**Contact**: sales@islandpurewater.com | (516) 555-0123
**Office Hours**: Mon-Sat 8am-6pm
**Emergency Service**: 24/7 available for existing clients

**Proposal Valid Through**: November 24, 2025

---

*This proposal was prepared based on typical water conditions in Wantagh, NY.
Final pricing may be adjusted based on water test results and specific site
conditions discovered during installation.*
```

---

## Step 6: Artifacts & Knowledge Capture

### task-executor completes

**Artifacts Created**:
1. `proposal-john-smith-wantagh-20251024.pdf` (6 pages)
2. `water-test-checklist.pdf` (what to test for)
3. `installation-timeline.pdf` (detailed schedule)

**Event 5**: `task_progress` (50% - document generated)
**Event 6**: `task_progress` (100% - artifacts attached)
**Event 7**: `state_transition` (pending → succeeded)

### forest-graph captures knowledge

**Summary Node: SUM-7821**
```markdown
# Proposal Prepared: John Smith - Wantagh Whole Home Filtration

Successfully generated comprehensive proposal for potential client
in Wantagh, Long Island.

## Key Details
- **System Recommended**: WholeGuard Pro 5000 + softener + UV
- **Total Investment**: $9,875
- **Timeline**: 2-day installation
- **Financing**: Multiple options offered

## Context Used
- Similar project in Massapequa (PRJ-2847) - 8 miles away
- Long Island water quality knowledge (KNW-0834)
- Pricing template (TMPL-0456)

## Unique Factors
- Wantagh is South Shore location (coastal)
- Nassau County permit requirements
- Mentioned Sarah Chen testimonial from Massapequa

## Follow-Up Actions
- Schedule water test (client must approve)
- Send proposal via email
- Follow up in 3 business days

## Auto-Linked To
- ISS-5432 (client inquiry issue)
- PRJ-2847 (Massapequa project - similar)
- KNW-0834 (Long Island water knowledge)
- PROD-1205 (WholeGuard Pro 5000)
```

**Forest Auto-Links** (via embeddings):
- `SUM-7821 --similar--> PRJ-2847` (score: 0.91)
- `SUM-7821 --similar--> PRJ-3104` (score: 0.84)
- `SUM-7821 --references--> KNW-0834`
- `SUM-7821 --references--> PROD-1205`

**Event 8**: `summary_created` (SUM-7821)
**Event 9**: `artifacts_attached` (3 PDFs)

---

## Step 7: Session Commit

### session-ledger finalizes

**Event 10**: `session_committed`

**Session Summary**:
```
Session: sess-a8f2
Duration: 4.2 seconds
Total Events: 11
Nodes Created: 3 (ISS-5432, TSK-4521, SUM-7821)
Edges Created: 6 (1 executes, 5 auto-linked)
Artifacts: 3 PDFs
Status: committed
```

---

## Step 8: User Presentation

### workflow-orchestrator formats response

```
✅ Proposal prepared successfully for John Smith (Wantagh, Long Island)

📄 Generated Documents:
  • Comprehensive proposal (6 pages) - proposal-john-smith-wantagh-20251024.pdf
  • Water testing checklist - water-test-checklist.pdf
  • Installation timeline - installation-timeline.pdf

💡 Key Recommendations:
  • System: WholeGuard Pro 5000 + Softener + UV
  • Investment: $9,875 (financing available)
  • Timeline: 2-day installation

📊 Context Used:
  • Similar project: Massapequa (8 mi away, 95% satisfaction)
  • Local knowledge: Nassau County water quality & regulations
  • Product data: WholeGuard Pro 5000 specs & pricing

📋 Issue Created: ISS-5432
📋 Task Completed: TSK-4521

Next Steps:
  1. Review proposal: crown show ISS-5432
  2. View artifacts: crown artifacts TSK-4521
  3. Send to client: crown send-email ISS-5432 --attach proposal
  4. Schedule follow-up: crown remind ISS-5432 --in 3-days

Query time: 4.2s
```

---

## What This Demonstrates

### 1. **Semantic Knowledge Retrieval**
- Forest found Massapequa project (8 miles away) automatically via embeddings
- "Wantagh water filtration" semantically matched "Massapequa water filtration"
- No manual tagging needed - AI understood geographic + domain similarity

### 2. **Context Synthesis**
- Combined knowledge from 4 different sources:
  - Past projects (PRJ-2847, PRJ-3104)
  - Regional knowledge (KNW-0834)
  - Product catalog (PROD-1205)
  - Pricing templates (TMPL-0456)
- AI synthesized into coherent, customized proposal

### 3. **Institutional Memory**
- Sarah Chen testimonial from 6 months ago automatically included
- Hard-learned lesson about crawl space access mentioned
- Nassau County permit requirements remembered

### 4. **Auto-Linking**
- Summary node automatically linked to related context
- Future queries will find this proposal when searching similar projects
- Graph grows organically with each interaction

### 5. **Multi-Step Execution**
- Single command triggered:
  - Knowledge retrieval
  - Document generation
  - Artifact creation
  - Graph updates
  - Session logging
- All tracked in audit trail

---

## How This Scales

### For a Growing Business

**After 100 proposals**:
- Forest has learned pricing patterns by region
- Knows which products work best for which water conditions
- Understands seasonal demand (spring = busy, winter = slow)
- Can suggest upsells based on similar customer profiles

**Query Examples**:
```bash
crown "What's our average close rate for whole-home systems in Nassau County?"
crown "Show me all projects with post-installation issues"
crown "Which product has the highest customer satisfaction?"
crown "Generate a proposal for similar client in Suffolk County"
```

**Pattern Recognition**:
- "Clients in coastal areas often need UV sterilization"
- "Well water systems average 30% higher price"
- "November has highest proposal acceptance rate"
- "Customers who finance are 2x more likely to add UV option"

---

## Forest Graph After This Interaction

```
ISS-5432 (Client Inquiry: John Smith)
  ├─ executed by ─→ TSK-4521 (Prepare Proposal)
  │                  └─ logs ─→ Session sess-a8f2
  │                  └─ artifacts ─→ 3 PDFs
  │
  └─ summary ─→ SUM-7821 (Proposal Summary)
                 ├─ similar (0.91) ─→ PRJ-2847 (Massapequa project)
                 ├─ similar (0.84) ─→ PRJ-3104 (Hicksville project)
                 ├─ references ─→ KNW-0834 (LI water knowledge)
                 └─ references ─→ PROD-1205 (WholeGuard Pro)

All queryable, all connected, all building institutional knowledge!
```

---

## Comparison: Without Forest

**Traditional System**:
```
1. Salesperson searches Salesforce for similar projects (manual, 10 min)
2. Opens product catalog spreadsheet (separate system)
3. Looks up pricing in pricing guide (PDF, 5 min)
4. Googles "Long Island water quality" (5 min)
5. Copies/pastes template in Word (10 min)
6. Manually fills in details (20 min)
7. Saves to Dropbox (scattered files)
8. Emails to client
9. Creates reminder in calendar
Total time: ~50 minutes, manual process, knowledge scattered
```

**With Forest + Crown**:
```
1. crown "Prepare proposal for John Smith in Wantagh, whole home filtration"
2. System queries Forest (800ms)
3. Finds similar projects automatically
4. Generates customized proposal
5. Creates issue + task + summary
6. Links all related knowledge
7. Presents actionable next steps
Total time: 4.2 seconds, automated, knowledge consolidated
```

**10x faster, 100% consistent, perpetually learning.**

---

This demonstrates how `forest-graph` + `workflow-orchestrator` + `forest-query-engine` work together to deliver intelligent, context-aware business automation that gets smarter over time!
