#!/usr/bin/env bash
set -euo pipefail

# Forest CLI Interactive Demo
# Showcases the cozy forest knowledge graph with 521 nodes about
# rivers, canals, trees, birds, mushrooms, trails, and more.

# Colors for output
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

# Helper functions
section() {
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN}$1${RESET}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

cmd() {
  echo -e "${GREEN}$ ${YELLOW}$1${RESET}"
  echo ""
}

pause() {
  echo ""
  echo -e "${CYAN}Press Enter to continue...${RESET}"
  read -r
}

# Intro
clear
section "🌲 Welcome to Forest CLI Demo 🍄"
cat <<EOF
This demo explores a cozy knowledge graph containing:
  • 521 nodes about nature, history, and wilderness skills
  • 313 accepted connections
  • 1,602 suggested links waiting for review

Topics include:
  🦅 Songbird migration patterns
  🌳 Appalachian Trail trees
  🐟 Hudson River fish ecology
  🚢 Erie Canal history
  🌸 Pacific Northwest wildflowers
  🏔️  Great Lakes geology
  🥾 Native American trails
  🍄 Forest mushrooms
  🌊 New England rivers
  🔥 Woodland bushcraft skills
  🗼 Atlantic lighthouses

Let's explore how Forest helps you discover connections!
EOF
pause

# Section 1: Graph Health Check
section "1. Graph Health Check"
cat <<EOF
First, let's see what's in our knowledge graph.
EOF
echo ""
cmd "forest doctor"
forest doctor
pause

# Section 2: Graph Statistics
section "2. Graph Statistics"
cat <<EOF
The stats command shows network metrics and emergent themes.
Notice the tag distribution - our cozy forest theme shines through!
EOF
echo ""
cmd "forest stats --top 15"
forest stats --top 15
pause

# Section 3: Tag Co-occurrence
section "3. Tag Co-occurrence Analysis"
cat <<EOF
Which tags appear together most often? This reveals topic clusters.
EOF
echo ""
cmd "forest tags stats --min-count 5 --top 15"
forest tags stats --min-count 5 --top 15
echo ""
echo -e "${CYAN}Notice patterns like:${RESET}"
echo "  • basin + lake (Great Lakes geology)"
echo "  • connecticut + river (New England watersheds)"
echo "  • canal + erie (Erie Canal history)"
pause

# Section 4: Explore by Tag - Rivers
section "4. Exploring River Content"
cat <<EOF
Let's explore notes tagged with 'river'. With 40 river-tagged notes,
we have rich content about New England watersheds.
EOF
echo ""
cmd "forest explore --tag river --sort degree --limit 5"
forest explore --tag river --sort degree --limit 5
pause

# Section 5: Specific Tag Co-occurrence
section "5. What Topics Connect to Rivers?"
cat <<EOF
Let's see which tags most frequently co-occur with 'river'.
EOF
echo ""
cmd "forest tags stats --tag river --top 10"
forest tags stats --tag river --top 10
echo ""
echo -e "${CYAN}Fish, flow, Connecticut, Merrimack - the ecosystem emerges!${RESET}"
pause

# Section 6: Explore Hub Node
section "6. High-Degree Hub Nodes"
cat <<EOF
Some notes become natural hubs. Let's explore our highest-degree node:
the Merrimack River System (degree 12).
EOF
echo ""
cmd "forest explore 'Merrimack River System' --include-suggestions"
forest explore "Merrimack River System" --include-suggestions | head -35
pause

# Section 7: Insights - The Curation Layer
section "7. Insights: Reviewing Suggested Links"
cat <<EOF
Forest auto-generated 1,602 suggested connections between notes.
Let's see the top-scoring suggestions using 4-char codes for quick reference.
EOF
echo ""
cmd "forest insights list --limit 10"
forest insights list --limit 10
pause

# Section 8: Accept a Suggestion
section "8. Accepting a Suggestion with 4-Char Code"
cat <<EOF
Let's accept the top suggestion using its 4-char code.
This is much faster than typing long UUIDs!
EOF
echo ""
TOP_CODE=$(forest insights list --limit 1 --json | jq -r '.[0].code')
cmd "forest insights explain $TOP_CODE"
forest insights explain "$TOP_CODE"
echo ""
cmd "forest insights accept $TOP_CODE"
forest insights accept "$TOP_CODE"
pause

# Section 9: Undo
section "9. Undo Feature"
cat <<EOF
Made a mistake? Undo is your safety net.
Let's undo that accept to restore the suggestion.
EOF
echo ""
cmd "forest insights undo $TOP_CODE"
forest insights undo "$TOP_CODE"
echo ""
echo -e "${GREEN}✓ Suggestion restored!${RESET}"
pause

# Section 10: Bulk Operations with jq
section "10. Bulk Operations with jq"
cat <<EOF
For power users: accept all high-confidence suggestions (≥ 0.40) at once.
We'll use jq to filter and xargs to batch the accepts.
EOF
echo ""
cmd "forest insights list --json | jq -r '.[] | select(.score >= 0.40) | .code' | head -5"
forest insights list --json | jq -r '.[] | select(.score >= 0.40) | .code' | head -5
echo ""
echo -e "${CYAN}(In a real workflow, pipe to: xargs -n1 forest insights accept)${RESET}"
pause

# Section 11: Tag Cluster Exploration
section "11. Deep Dive: Mushroom Content"
cat <<EOF
Let's explore the mushroom domain in our graph.
EOF
echo ""
cmd "forest tags stats --tag mushroom --top 8"
forest tags stats --tag mushroom --top 8
echo ""
echo -e "${CYAN}Armillaria, death, amanita - we have poisonous species coverage!${RESET}"
echo ""
cmd "forest explore --tag mushroom,death --limit 3"
forest explore --tag mushroom,death --limit 3
pause

# Section 12: Cross-Topic Discovery
section "12. Cross-Topic Discovery"
cat <<EOF
Forest connects different domains. Let's find notes about both
rivers AND fish to see ecosystem connections.
EOF
echo ""
cmd "forest explore --tag river,fish --sort degree --limit 5"
forest explore --tag river,fish --sort degree --limit 5
pause

# Section 13: Time-Based Exploration
section "13. Time-Based Filtering"
cat <<EOF
See what was recently added to the graph.
EOF
echo ""
cmd "forest explore --since 2025-10-18 --sort recent --limit 8"
forest explore --since 2025-10-18 --sort recent --limit 8
pause

# Section 14: Export for Visualization
section "14. Export to Graphviz"
cat <<EOF
Let's export a neighborhood for visualization.
We'll use a high-degree hub node and include suggested edges.
EOF
echo ""

# Get a high-degree node ID
HUB_ID=$(forest doctor --json | jq -r '.highDegree[0].id' | cut -d'-' -f1)

cmd "forest export graphviz --id $HUB_ID --depth 2 --include-suggestions --file /tmp/forest-demo.dot"
forest export graphviz --id "$HUB_ID" --depth 2 --include-suggestions --file /tmp/forest-demo.dot
echo ""
echo -e "${GREEN}✓ Exported to /tmp/forest-demo.dot${RESET}"
echo ""
echo -e "${CYAN}To render: dot -Tpng /tmp/forest-demo.dot -o /tmp/forest-demo.png${RESET}"
pause

# Section 15: Full Graph Export
section "15. Backup: Export Full Graph"
cat <<EOF
Export the entire graph as JSON for backup or analysis.
EOF
echo ""
cmd "forest export json --file /tmp/forest-backup.json"
forest export json --file /tmp/forest-backup.json
echo ""
NODES=$(jq '.nodes | length' /tmp/forest-backup.json)
EDGES=$(jq '.edges | length' /tmp/forest-backup.json)
echo -e "${GREEN}✓ Exported $NODES nodes and $EDGES edges${RESET}"
pause

# Section 16: Capture New Content
section "16. Adding New Knowledge"
cat <<EOF
Let's capture a new observation and watch Forest auto-link it.
EOF
echo ""
cmd "forest capture --title 'Demo observation: Forest mushrooms in October' --body 'October is prime mushroom season in temperate forests. Look for oyster mushrooms on dead hardwoods and chanterelles under oak trees. The first frost often triggers a final flush of cold-tolerant species.'"
forest capture --title "Demo observation: Forest mushrooms in October" --body "October is prime mushroom season in temperate forests. Look for oyster mushrooms on dead hardwoods and chanterelles under oak trees. The first frost often triggers a final flush of cold-tolerant species."
pause

# Finale
section "🎉 Demo Complete!"
cat <<EOF
You've explored Forest's core features:

  ✓ Graph health monitoring (doctor, stats)
  ✓ Tag co-occurrence analysis (tags stats)
  ✓ Multi-dimensional search (tags, dates, sorting)
  ✓ Insight curation (4-char codes, accept/reject, undo)
  ✓ Bulk operations (jq pipelines)
  ✓ Visualization (graphviz export)
  ✓ Backup (JSON export)
  ✓ Auto-linking (capture with semantic connections)

Our cozy forest graph contains:
  • 521+ notes about nature, history, and wilderness
  • Automatically discovered connections between topics
  • Rich tag-based navigation across domains

Next steps:
  • Review pending suggestions: forest insights list
  • Explore a topic: forest explore --tag <your-topic>
  • Add your own notes: forest capture --stdin < mynote.md
  • Check graph stats: forest stats

Happy exploring! 🌲🦅🍄🌊
EOF
echo ""
