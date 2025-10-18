#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  EdgeRecord,
  EdgeStatus,
  NodeRecord,
  SearchMatch,
  getLastEdgeEventForPair,
  logEdgeEvent,
  markEdgeEventUndone,
  listEdgeEvents,
  deleteSuggestion,
  deleteEdgeBetween,
  findNodeByTitle,
  getNodeById,
  deleteNode,
  insertNode,
  insertOrUpdateEdge,
  listEdges,
  listNodes,
  promoteSuggestions,
  searchNodes,
  updateNode,
  updateNodeIndexData,
} from './lib/db';
import { collectNeighborhood, buildGraph } from './lib/graph';
import { extractTags, pickTitle, tokenize } from './lib/text';
import {
  classifyScore,
  computeScore,
  getAutoAcceptThreshold,
  getSuggestionThreshold,
  normalizeEdgePair,
} from './lib/scoring';

const SHORT_ID_LENGTH = 8;
const DEFAULT_SEARCH_LIMIT = 6;
const DEFAULT_NEIGHBORHOOD_LIMIT = 25;
const DEFAULT_MATCH_DISPLAY_LIMIT = 6;

const program = new Command();
program
  .name('forest')
  .description('Graph-native knowledge base CLI')
  .version('0.1.0');

program
  .command('capture')
  .description('Capture a new idea and auto-link it into the graph')
  .option('-t, --title <title>', 'Title for the idea')
  .option('-b, --body <body>', 'Body content; if omitted use --file or --stdin')
  .option('-f, --file <path>', 'Read body from file')
  .option('--stdin', 'Read body from standard input')
  .option('--tags <tags>', 'Comma-separated list of tags to force (overrides auto-detected tags)')
  .option('--no-auto-link', 'Skip scoring/linking against existing nodes')
  .option('--preview', 'Force an explore preview after capture')
  .option('--no-preview', 'Skip the explore preview after capture')
  .option('--preview-suggestions-only', 'In preview, only show suggestions (hide metadata and accepted edges)')
  .option('--json', 'Emit JSON output for the capture summary')
  .action(async (options) => {
    try {
      const body = await resolveBody(options.body, options.file, options.stdin);
      if (!body || body.trim().length === 0) {
        console.error('✖ No content provided. Use --body, --file, or --stdin.');
        process.exitCode = 1;
        return;
      }

      const title = pickTitle(body, options.title);
      const combinedText = `${title}\n${body}`;
      const tokenCounts = tokenize(combinedText);
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag.length > 0)
        : extractTags(combinedText, tokenCounts);

      const newNode: NodeRecord = {
        id: randomUUID(),
        title,
        body,
        tags,
        tokenCounts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingNodes = await listNodes();
      await insertNode(newNode);

      let summary: { accepted: number; suggested: number } = { accepted: 0, suggested: 0 };
      // Commander maps --no-auto-link to options.autoLink === false
      if (options.autoLink !== false) {
        summary = await linkAgainstExisting(newNode, existingNodes);
      }

      if (options.json) {
        const suggestions = await fetchSuggestionsForNode(newNode.id);
        console.log(
          JSON.stringify(
            {
              node: {
                id: newNode.id,
                title: newNode.title,
                tags: newNode.tags,
                createdAt: newNode.createdAt,
                updatedAt: newNode.updatedAt,
              },
              body: newNode.body,
              links: {
                autoLinked: options.autoLink !== false,
                accepted: summary.accepted,
                suggested: summary.suggested,
                thresholds: {
                  auto: getAutoAcceptThreshold(),
                  suggest: getSuggestionThreshold(),
                },
              },
              suggestions: suggestions.map((s) => ({
                id: s.id,
                score: s.score,
                otherId: s.otherId,
                otherTitle: s.otherTitle,
              })),
            },
            null,
            2,
          )
        );
        return;
      } else {
        console.log(`✔ Captured idea: ${newNode.title}`);
        console.log(`   id: ${newNode.id}`);
        if (tags.length > 0) {
          console.log(`   tags: ${tags.join(', ')}`);
        }
        if (options.autoLink !== false) {
          console.log(
            `   links: ${summary.accepted} accepted, ${summary.suggested} pending (thresholds auto=${getAutoAcceptThreshold().toFixed(
              2,
            )}, suggest=${getSuggestionThreshold().toFixed(2)})`
          );
        } else {
          console.log('   links: auto-linking skipped (--no-auto-link)');
        }
      }

      // Determine preview behavior
      let shouldPreview = true;
      if (options.noPreview) shouldPreview = false;
      if (options.preview) shouldPreview = true;

      if (shouldPreview) {
        console.log('\nPreview:');
        const selection: SelectionResult = {
          selected: { node: newNode, score: 1 },
          matches: [{ node: newNode, score: 1 }],
          limit: 1,
        };
        await printExplore({
          selection,
          limit: 15,
          depth: 1,
          // If we performed auto-linking, include suggestions in the preview
          includeSuggestions: options.autoLink !== false,
          longIds: false,
          json: false,
          showMatches: false,
          focusSelected: true,
          suppressOverview: Boolean(options.previewSuggestionsOnly),
        });
      }
    } catch (error) {
      handleError(error);
    }
  });

// parse argv after all commands are registered (moved to EOF)

program
  .command('explore')
  .description('Search for a note and inspect its graph neighborhood')
  .argument('[term]', 'Title, tag, or search phrase to locate the node')
  .option('--id <id>', 'Node id to focus on')
  .option('--title <title>', 'Node title to match (case-insensitive)')
  .option('--select <index>', '1-based index of the match to explore', (value) => Number(value))
  .option('--search-limit <count>', 'Maximum matches to consider', toNumber)
  .option('--tag <tags>', 'Filter by notes containing all tags (comma-separated)')
  .option('--any-tag <tags>', 'Filter by notes containing any of the tags (comma-separated)')
  .option('--since <date>', 'Only include notes updated on/after this date (YYYY-MM-DD or ISO)')
  .option('--before <date>', 'Only include notes updated before this date (YYYY-MM-DD or ISO)')
  .option('--until <date>', 'Alias of --before')
  .option('--sort <mode>', 'Sort matches: score|recent|degree')
  .option('-d, --depth <depth>', 'Neighborhood depth', toNumber, 1)
  .option('-l, --limit <limit>', 'Maximum number of nodes in neighborhood', toNumber)
  .option('--include-suggestions', 'Include suggested edges in the neighborhood output')
  .option('--long-ids', 'Display full ids in human-readable output')
  .option('--json', 'Emit JSON instead of text output')
  .option('--interactive', 'Prompt to choose a match')
  .action(async (term, options) => {
    try {
      const neighborhoodLimit =
        typeof options.limit === 'number' && !Number.isNaN(options.limit) ? options.limit : DEFAULT_NEIGHBORHOOD_LIMIT;
      const searchLimit =
        typeof options.searchLimit === 'number' && !Number.isNaN(options.searchLimit)
          ? options.searchLimit
          : typeof options.limit === 'number' && !Number.isNaN(options.limit)
          ? options.limit
          : DEFAULT_SEARCH_LIMIT;

      const termValue = typeof term === 'string' ? term : undefined;
      const selection = await selectNode({
        id: options.id,
        title: options.title,
        term: termValue,
        limit: searchLimit,
        select: options.select,
        interactive: Boolean(options.interactive),
        tagsAll: parseCsvList(options.tag),
        tagsAny: parseCsvList(options.anyTag),
        since: parseDate(options.since),
        until: parseDate(options.before ?? options.until),
        sort: normalizeSort(options.sort),
      });

      const hasSearchTerm = typeof termValue === 'string' && termValue.trim().length > 0;
      const focusSelected =
        Boolean(options.id) ||
        Boolean(options.title) ||
        typeof options.select === 'number' ||
        hasSearchTerm;

      await printExplore({
        selection,
        limit: neighborhoodLimit,
        matchLimit: searchLimit,
        depth: options.depth,
        includeSuggestions: Boolean(options.includeSuggestions),
        longIds: Boolean(options.longIds),
        json: Boolean(options.json),
        showMatches: !Boolean(options.json),
        focusSelected: focusSelected || Boolean(options.json),
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('edit')
  .description('Edit an existing note and optionally rescore links')
  .argument('<id>', 'Node id or short id to edit')
  .option('--title <title>', 'New title')
  .option('--body <body>', 'New body content')
  .option('--file <path>', 'Read new body from file')
  .option('--stdin', 'Read new body from standard input')
  .option('--tags <tags>', 'Comma-separated list of tags to set (overrides auto-detected tags)')
  .option('--no-auto-link', 'Skip rescoring/linking against existing nodes')
  .action(async (idRef, options) => {
    try {
      const node = await resolveNodeReference(String(idRef));
      if (!node) {
        console.error('✖ No node found. Provide a full id or unique short id.');
        process.exitCode = 1;
        return;
      }

      const nextTitle = typeof options.title === 'string' ? options.title : node.title;
      let nextBody = node.body;
      if (typeof options.body === 'string') {
        nextBody = options.body;
      } else if (options.file) {
        const filePath = path.resolve(options.file);
        nextBody = fs.readFileSync(filePath, 'utf-8');
      } else if (options.stdin) {
        nextBody = await readStdin();
      }

      const combinedText = `${nextTitle}\n${nextBody}`;
      const tokenCounts = tokenize(combinedText);
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0)
        : extractTags(combinedText, tokenCounts);

      await updateNode(node.id, {
        title: nextTitle,
        body: nextBody,
        tags,
        tokenCounts,
      });

      let accepted = 0;
      let suggested = 0;
      if (options.autoLink !== false) {
        const all = await listNodes();
        for (const other of all) {
          if (other.id === node.id) continue;
          const { score, components } = computeScore(
            { ...node, title: nextTitle, body: nextBody, tags, tokenCounts },
            other,
          );
          const status = classifyScore(score);
          const [sourceId, targetId] = normalizeEdgePair(node.id, other.id);
          if (status === 'discard') {
            await deleteEdgeBetween(sourceId, targetId);
            continue;
          }
          const edge: EdgeRecord = {
            id: edgeIdentifier(sourceId, targetId),
            sourceId,
            targetId,
            score,
            status,
            metadata: { components },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await insertOrUpdateEdge(edge);
          if (status === 'accepted') accepted += 1;
          if (status === 'suggested') suggested += 1;
        }
      }

      console.log(`✔ Updated note: ${nextTitle}`);
      console.log(`   id: ${node.id}`);
      if (tags.length > 0) console.log(`   tags: ${tags.join(', ')}`);
      if (options.autoLink !== false) {
        console.log(`   links after rescore: ${accepted} accepted, ${suggested} pending`);
      } else {
        console.log('   links: rescoring skipped (--no-auto-link)');
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('delete')
  .description('Delete a note and its edges')
  .argument('<id>', 'Node id or short id to delete')
  .option('--force', 'Do not prompt for confirmation (non-interactive mode)')
  .action(async (idRef, options) => {
    try {
      const node = await resolveNodeReference(String(idRef));
      if (!node) {
        console.error('✖ No node found. Provide a full id or unique short id.');
        process.exitCode = 1;
        return;
      }
      // Non-interactive CLI: honor --force and proceed.
      const result = await deleteNode(node.id);
      if (!result.nodeRemoved) {
        console.error('✖ Node could not be removed.');
        process.exitCode = 1;
        return;
      }
      console.log(`✔ Deleted note ${formatId(node.id)} (${node.title})`);
      console.log(`   removed ${result.edgesRemoved} associated edges`);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('link')
  .description('Manually create an edge between two notes')
  .argument('<a>', 'Source node id or short id')
  .argument('<b>', 'Target node id or short id')
  .option('--score <score>', 'Override score value', parseFloat)
  .option('--suggest', 'Create as a suggestion instead of accepted')
  .option('--explain', 'Print scoring components')
  .action(async (aRef, bRef, options) => {
    try {
      const a = await resolveNodeReference(String(aRef));
      const b = await resolveNodeReference(String(bRef));
      if (!a || !b) {
        console.error('✖ Both endpoints must resolve to existing notes.');
        process.exitCode = 1;
        return;
      }
      const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);
      const usedScore = typeof options.score === 'number' ? options.score : computeScore(a, b).score;
      const components = computeScore(a, b).components;
      const status: EdgeStatus = options.suggest ? 'suggested' : 'accepted';
      const edge: EdgeRecord = {
        id: edgeIdentifier(sourceId, targetId),
        sourceId,
        targetId,
        score: usedScore,
        status,
        metadata: { components },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdateEdge(edge);
      console.log(
        `✔ Linked ${formatId(sourceId)}::${formatId(targetId)}  status=${status}  score=${usedScore.toFixed(2)}`
      );
      if (options.explain) {
        console.log('components:');
        for (const [k, v] of Object.entries(components)) {
          if (typeof v === 'number') console.log(`  ${k}: ${v.toFixed(3)}`);
          else console.log(`  ${k}: ${String(v)}`);
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

const insights = program.command('insights').description('Manage suggested edges');

insights
  .command('list')
  .description('List suggested links ordered by score')
  .option('--limit <limit>', 'Limit number of suggestions returned', toNumber, 10)
  .option('--long-ids', 'Display full identifiers in output')
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const edges = (await listEdges('suggested'))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit);

      if (edges.length === 0) {
        console.log('No suggestions ready.');
        return;
      }

      const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
      const longIds = Boolean(options.longIds);

      if (options.json) {
        console.log(
          JSON.stringify(
            edges.map((edge, index) => ({
              index: index + 1,
              id: edge.id,
              shortId: describeSuggestion(edge, nodeMap, { longIds }).shortId,
              code: describeSuggestion(edge, nodeMap, { longIds }).code,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              sourceTitle: nodeMap.get(edge.sourceId)?.title ?? null,
              targetTitle: nodeMap.get(edge.targetId)?.title ?? null,
              score: edge.score,
              metadata: edge.metadata,
            })),
            null,
            2
          )
        );
        return;
      }

      edges.forEach((edge, index) => {
        const desc = describeSuggestion(edge, nodeMap, { longIds });
        const indexLabel = String(index + 1).padStart(2, ' ');
        console.log(
          `${indexLabel}. [${desc.code}] ${desc.edgeId}  score=${edge.score.toFixed(2)}  ${desc.sourceLabel} ↔ ${desc.targetLabel}`
        );
      });
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('promote')
  .description('Promote suggestions above a score threshold to accepted edges')
  .option('--min-score <score>', 'Minimum score to accept', parseFloat, getAutoAcceptThreshold())
  .action(async (options) => {
    try {
      const changes = await promoteSuggestions(options.minScore);
      console.log(`✔ Promoted ${changes} suggestions with score ≥ ${options.minScore.toFixed(2)}`);
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('accept')
  .description('Promote a single suggestion by index, short pair, or edge id')
  .argument('<ref>', 'Suggestion index (1-based), short pair (abcd::efgh), or full edge id')
  .action(async (ref) => {
    try {
      const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
      if (suggestions.length === 0) {
        console.error('✖ No suggestions available.');
        process.exitCode = 1;
        return;
      }

      const edge = resolveSuggestionReference(ref, suggestions);
      if (!edge) {
        console.error('✖ No suggestion matched that reference. Run `forest insights list` to see indexes.');
        process.exitCode = 1;
        return;
      }

      const accepted: EdgeRecord = {
        ...edge,
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      };
      // Log event for undo
      await logEdgeEvent({
        edgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        prevStatus: edge.status,
        nextStatus: 'accepted',
        payload: { score: edge.score, metadata: edge.metadata },
      });
      await insertOrUpdateEdge(accepted);
      console.log(
        `✔ Accepted suggestion ${formatId(edge.sourceId)}::${formatId(edge.targetId)}`
      );
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('reject')
  .description('Reject and remove a suggestion by index, short pair, or edge id')
  .argument('<ref>', 'Suggestion index (1-based), short pair (abcd::efgh), or full edge id')
  .action(async (ref) => {
    try {
      const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
      if (suggestions.length === 0) {
        console.error('✖ No suggestions available.');
        process.exitCode = 1;
        return;
      }

      const edge = resolveSuggestionReference(ref, suggestions);
      if (!edge) {
        console.error('✖ No suggestion matched that reference. Run `forest insights list` to see indexes.');
        process.exitCode = 1;
        return;
      }

      // Log event with enough payload to undo by re-inserting
      await logEdgeEvent({
        edgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        prevStatus: edge.status,
        nextStatus: 'deleted',
        payload: { score: edge.score, metadata: edge.metadata },
      });
      const removed = await deleteSuggestion(edge.id);
      if (removed === 0) {
        console.error('✖ Suggestion could not be removed.');
        process.exitCode = 1;
        return;
      }
      console.log(
        `✔ Removed suggestion ${formatId(edge.sourceId)}::${formatId(edge.targetId)}`
      );
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('sweep')
  .description('Bulk-reject suggestions by index range or score')
  .option('--range <spec>', 'Comma-separated indexes or ranges (e.g., 1-10,15)')
  .option('--max-score <score>', 'Reject suggestions at or below this score', parseFloat)
  .action(async (options) => {
    try {
      const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
      if (suggestions.length === 0) {
        console.log('No suggestions ready.');
        return;
      }
      let targets = new Set<number>();
      if (typeof options.range === 'string' && options.range.trim().length > 0) {
        for (const part of String(options.range).split(',')) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          const m = trimmed.match(/^(\d+)-(\d+)$/);
          if (m) {
            const start = Number(m[1]);
            const end = Number(m[2]);
            for (let i = start; i <= end; i += 1) targets.add(i);
          } else if (/^\d+$/.test(trimmed)) {
            targets.add(Number(trimmed));
          }
        }
      }
      if (typeof options.maxScore === 'number') {
        const eps = 1e-9;
        suggestions.forEach((edge, idx) => {
          if (edge.score <= options.maxScore + eps) targets.add(idx + 1);
        });
      }
      const toDelete = [...targets]
        .filter((n) => n >= 1 && n <= suggestions.length)
        .sort((a, b) => a - b);
      if (toDelete.length === 0) {
        console.log('No matches to remove.');
        return;
      }
      let removed = 0;
      for (const n of toDelete) {
        const edge = suggestions[n - 1];
        const changes = await deleteSuggestion(edge.id);
        if (changes > 0) removed += 1;
      }
      console.log(`✔ Removed ${removed} suggestions`);
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('explain')
  .description('Explain how a link was scored by id or short pair')
  .argument('<ref>', 'Edge id or short pair (abcd::efgh)')
  .option('--json', 'Emit JSON output')
  .action(async (ref, options) => {
    try {
      const edges = await listEdges('all');
      const match = resolveEdgeReference(ref, edges);
      if (!match) {
        console.error('✖ No edge matched that reference.');
        process.exitCode = 1;
        return;
      }
      const nodes = await listNodes();
      const a = nodes.find((n) => n.id === match.sourceId)!;
      const b = nodes.find((n) => n.id === match.targetId)!;
      const components = (match.metadata as any)?.components ?? computeScore(a, b).components;
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              id: match.id,
              sourceId: match.sourceId,
              targetId: match.targetId,
              code: edgeShortCode(match.sourceId, match.targetId),
              score: match.score,
              status: match.status,
              components,
            },
            null,
            2,
          )
        );
        return;
      }
      const code = edgeShortCode(match.sourceId, match.targetId);
      console.log(`${formatId(match.sourceId)}::${formatId(match.targetId)} [${code}]  status=${match.status}  score=${match.score.toFixed(2)}`);
      console.log('components:');
      for (const [k, v] of Object.entries(components)) {
        if (typeof v === 'number') console.log(`  ${k}: ${v.toFixed(3)}`);
        else console.log(`  ${k}: ${String(v)}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('undo')
  .description('Undo the last accept/reject action for a link')
  .argument('<ref>', 'Edge id, short pair (abcd::efgh), or 4-char code')
  .action(async (ref) => {
    try {
      const pair = await resolveEdgePairFromRef(ref);
      if (!pair) {
        console.error('✖ Could not resolve edge reference.');
        process.exitCode = 1;
        return;
      }
      const [sourceId, targetId] = pair;
      const ev = await getLastEdgeEventForPair(sourceId, targetId);
      if (!ev) {
        console.error('✖ No prior action found to undo.');
        process.exitCode = 1;
        return;
      }
      if (ev.nextStatus === 'accepted') {
        // Revert to suggested
        const edge: EdgeRecord = {
          id: `${sourceId}::${targetId}`,
          sourceId,
          targetId,
          score: (ev.payload?.score as number) ?? 0,
          status: 'suggested',
          metadata: ev.payload?.metadata ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await insertOrUpdateEdge(edge);
        await markEdgeEventUndone(ev.id);
        console.log(`✔ Undid accept: restored suggestion ${formatId(sourceId)}::${formatId(targetId)}`);
        return;
      }
      if (ev.nextStatus === 'deleted') {
        // Recreate suggestion that was rejected
        const edge: EdgeRecord = {
          id: `${sourceId}::${targetId}`,
          sourceId,
          targetId,
          score: (ev.payload?.score as number) ?? 0,
          status: 'suggested',
          metadata: ev.payload?.metadata ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await insertOrUpdateEdge(edge);
        await markEdgeEventUndone(ev.id);
        console.log(`✔ Undid reject: restored suggestion ${formatId(sourceId)}::${formatId(targetId)}`);
        return;
      }
      console.error('✖ Nothing to undo for this edge.');
      process.exitCode = 1;
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('doctor')
  .description('Show graph health metrics and recent activity')
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const edges = await listEdges('all');
      const graph = await buildGraph();

      const counts = {
        nodes: nodes.length,
        edgesAccepted: edges.filter((edge) => edge.status === 'accepted').length,
        edgesSuggested: edges.filter((edge) => edge.status === 'suggested').length,
      };

      const nodeMap = new Map(nodes.map((node) => [node.id, node]));

      const recent = [...nodes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

      const degrees = nodes
        .map((node) => ({
          node,
          degree: graph.hasNode(node.id) ? graph.degree(node.id) : 0,
        }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 5);

      const suggestions = (await listEdges('suggested'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              counts,
              recent: recent.map((node) => ({
                id: node.id,
                title: node.title,
                tags: node.tags,
                updatedAt: node.updatedAt,
              })),
              highDegree: degrees.map((entry) => ({
                id: entry.node.id,
                title: entry.node.title,
                degree: entry.degree,
              })),
              suggestions: suggestions.map((edge, index) => {
                const desc = describeSuggestion(edge, nodeMap, { longIds: true });
                return {
                  index: index + 1,
                  id: edge.id,
                  shortId: desc.shortId,
                  code: desc.code,
                  score: edge.score,
                  sourceId: edge.sourceId,
                  targetId: edge.targetId,
                  sourceTitle: desc.sourceTitle,
                  targetTitle: desc.targetTitle,
                };
              }),
            },
            null,
            2
          )
        );
        return;
      }

      console.log('forest doctor');
      console.log(`Nodes: ${counts.nodes}`);
      console.log(`Accepted edges: ${counts.edgesAccepted}`);
      console.log(`Suggested edges: ${counts.edgesSuggested}`);
      console.log('');

      if (recent.length > 0) {
        console.log('Recent captures:');
        for (const node of recent) {
          console.log(`  ${formatId(node.id)}  ${node.title}  (updated ${node.updatedAt})`);
        }
        console.log('');
      }

      if (degrees.length > 0) {
        console.log('High-degree nodes:');
        for (const entry of degrees) {
          console.log(`  ${formatId(entry.node.id)}  ${entry.node.title}  (degree ${entry.degree})`);
        }
        console.log('');
      }

      if (suggestions.length > 0) {
        console.log('Top suggestions:');
        suggestions.forEach((edge, index) => {
          const desc = describeSuggestion(edge, nodeMap, { longIds: false });
          const indexLabel = String(index + 1).padStart(2, ' ');
          console.log(
            `  ${indexLabel}. [${desc.code}] ${desc.shortId}  score=${edge.score.toFixed(2)}  ${desc.sourceTitle ?? desc.sourceLabel} ↔ ${desc.targetTitle ?? desc.targetLabel}`
          );
        });
        console.log('');
      }

      console.log('Next steps:');
      console.log('  - Run `forest insights list` to triage pending links.');
      console.log('  - Capture new ideas with `forest capture`.');
    } catch (error) {
      handleError(error);
    }
  });

const tagsCmd = program.command('tags').description('Tag management');

tagsCmd
  .command('list')
  .description('List tags with usage counts')
  .option('--top <n>', 'Limit to top N', toNumber)
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const counts = new Map<string, number>();
      for (const node of nodes) {
        for (const tag of node.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      const items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const limited = typeof options.top === 'number' && !Number.isNaN(options.top)
        ? items.slice(0, options.top)
        : items;
      if (options.json) {
        console.log(JSON.stringify(limited.map(([tag, count]) => ({ tag, count })), null, 2));
        return;
      }
      if (limited.length === 0) {
        console.log('No tags found.');
        return;
      }
      limited.forEach(([tag, count]) => {
        console.log(`${String(count).padStart(3, ' ')}  ${tag}`);
      });
    } catch (error) {
      handleError(error);
    }
  });

tagsCmd
  .command('rename')
  .description('Rename a tag across all notes')
  .argument('<old>', 'Existing tag')
  .argument('<next>', 'New tag')
  .action(async (oldTag: string, nextTag: string) => {
    try {
      const nodes = await listNodes();
      let changed = 0;
      for (const node of nodes) {
        if (!node.tags.includes(oldTag)) continue;
        const next = Array.from(new Set(node.tags.map((t) => (t === oldTag ? nextTag : t))));
        await updateNodeIndexData(node.id, next, node.tokenCounts);
        changed += 1;
      }
      console.log(`✔ Renamed tag '${oldTag}' to '${nextTag}' on ${changed} notes`);
    } catch (error) {
      handleError(error);
    }
  });

tagsCmd
  .command('stats')
  .description('Show tag co-occurrence statistics')
  .option('--tag <tag>', 'Focus on a single tag and show co-occurring tags')
  .option('--min-count <n>', 'Only show items with count >= N', toNumber, 0)
  .option('--top <n>', 'Top N results to show', toNumber, 10)
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const co = new Map<string, number>();
      const counts = new Map<string, number>();
      for (const n of nodes) {
        const tags = Array.from(new Set(n.tags));
        for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (let i = 0; i < tags.length; i += 1) {
          for (let j = i + 1; j < tags.length; j += 1) {
            const a = tags[i];
            const b = tags[j];
            const key = a < b ? `${a}::${b}` : `${b}::${a}`;
            co.set(key, (co.get(key) ?? 0) + 1);
          }
        }
      }
      const min = typeof options.minCount === 'number' && Number.isFinite(options.minCount) ? options.minCount : 0;
      if (typeof options.tag === 'string' && options.tag.trim().length > 0) {
        const t = options.tag.trim();
        const items: Array<{ tag: string; count: number }> = [];
        for (const [pair, count] of co.entries()) {
          const [a, b] = pair.split('::');
          if (a === t) items.push({ tag: b, count });
          else if (b === t) items.push({ tag: a, count });
        }
        const filtered = items.filter((it) => it.count >= min);
        const top = filtered.sort((x, y) => y.count - x.count).slice(0, options.top);
        if (options.json) {
          console.log(JSON.stringify({ tag: t, coTags: top }, null, 2));
          return;
        }
        if (top.length === 0) {
          console.log(`No co-occurring tags for '${t}'.`);
          return;
        }
        console.log(`Top co-occurring tags with '${t}':`);
        top.forEach((it) => console.log(`  ${String(it.count).padStart(3, ' ')}  ${it.tag}`));
        return;
      }
      const topPairs = [...co.entries()]
        .filter(([, c]) => c >= min)
        .sort((a, b) => b[1] - a[1])
        .slice(0, options.top);
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              topTags: [...counts.entries()]
                .filter(([, c]) => c >= min)
                .sort((a, b) => b[1] - a[1])
                .slice(0, options.top)
                .map(([tag, count]) => ({ tag, count })),
              topPairs: topPairs.map(([pair, count]) => ({ pair, count })),
            },
            null,
            2,
          ),
        );
        return;
      }
      console.log('Top tag pairs:');
      topPairs.forEach(([p, c]) => console.log(`  ${String(c).padStart(3, ' ')}  ${p.replace('::', ' + ')}`));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('read')
  .description('Show the full content of a note')
  .argument('[id]', 'Node id or short id to read')
  .option('--meta', 'Show metadata summary without the body text')
  .option('--json', 'Emit JSON output')
  .option('--long-ids', 'Display full ids in text output')
  .action(async (idRef, options) => {
    try {
      const ref = typeof idRef === 'string' ? idRef.trim() : '';
      if (!ref) {
        console.error('✖ Provide a node id or unique short id (run `forest explore` to discover ids).');
        process.exitCode = 1;
        return;
      }

      const node = await resolveNodeReference(ref);
      if (!node) {
        console.error('✖ No node found. Provide a full id or unique short id.');
        process.exitCode = 1;
        return;
      }

      const longIds = Boolean(options.longIds);
      const metaOnly = Boolean(options.meta);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              node: {
                id: node.id,
                title: node.title,
                tags: node.tags,
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
              body: node.body,
            },
            null,
            2
          )
        );
        return;
      }

      const { directEdges } = await buildNeighborhoodPayload(node.id, 1, DEFAULT_NEIGHBORHOOD_LIMIT);
      printNodeOverview(node, directEdges, { longIds });
      if (!metaOnly) {
        console.log('');
        console.log(node.body);
      }
    } catch (error) {
      handleError(error);
    }
  });

const exportCmd = program.command('export').description('Export graph data');

exportCmd
  .command('graphviz')
  .description('Export a Graphviz DOT for a node neighborhood')
  .requiredOption('--id <id>', 'Center node id or short id')
  .option('-d, --depth <depth>', 'Neighborhood depth', toNumber, 1)
  .option('-l, --limit <limit>', 'Maximum nodes in neighborhood', toNumber, DEFAULT_NEIGHBORHOOD_LIMIT)
  .option('--include-suggestions', 'Include suggestion edges from the center node')
  .option('--file <path>', 'Write DOT output to a file instead of stdout')
  .action(async (options) => {
    try {
      const selection = await selectNode({ id: options.id });
      const center = selection.selected.node;
      const { payload, directEdges } = await buildNeighborhoodPayload(center.id, options.depth, options.limit);
      const nodes = await listNodes();
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const suggestions = Boolean(options.includeSuggestions)
        ? await fetchSuggestionsForNode(center.id)
        : [];

      const lines: string[] = [];
      lines.push('graph forest {');
      lines.push('  rankdir=LR;');
      lines.push('  node [shape=box, fontname="Helvetica"];');

      const defined = new Set<string>();
      const defNode = (id: string) => {
        if (defined.has(id)) return;
        const title = nodeMap.get(id)?.title ?? id;
        lines.push(`  "${id}" [label="${formatId(id)} ${escapeLabel(title)}"];`);
        defined.add(id);
      };

      payload.nodes.forEach((n) => defNode(n.id));
      // Accepted edges
      payload.edges.forEach((e) => {
        defNode(e.source);
        defNode(e.target);
        lines.push(`  "${e.source}" -- "${e.target}" [label="${e.score.toFixed(2)}"];`);
      });
      // Suggestions from center
      for (const s of suggestions) {
        defNode(center.id);
        defNode(s.otherId);
        lines.push(
          `  "${center.id}" -- "${s.otherId}" [style=dotted, color=gray50, label="${s.score.toFixed(2)}"];`
        );
      }

      lines.push('}');

      const dot = lines.join('\n');
      if (options.file) {
        const filePath = path.resolve(String(options.file));
        fs.writeFileSync(filePath, dot, 'utf-8');
      } else {
        console.log(dot);
      }
    } catch (error) {
      handleError(error);
    }
  });

exportCmd
  .command('json')
  .description('Export the full database as JSON')
  .option('--file <path>', 'Write JSON to a file instead of stdout')
  .option('--no-body', 'Exclude note bodies from export')
  .option('--no-edges', 'Exclude edges from export')
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const edges = await listEdges('all');
      const payload = {
        nodes: nodes.map((n) => ({
          id: n.id,
          title: n.title,
          tags: n.tags,
          body: options.body === false ? undefined : n.body,
          tokenCounts: n.tokenCounts,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        })),
        edges: options.edges === false
          ? []
          : edges.map((e) => ({
              id: e.id,
              sourceId: e.sourceId,
              targetId: e.targetId,
              status: e.status,
              score: e.score,
              metadata: e.metadata,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt,
            })),
      };
      const json = JSON.stringify(payload, null, 2);
      if (options.file) {
        const filePath = path.resolve(String(options.file));
        fs.writeFileSync(filePath, json, 'utf-8');
      } else {
        console.log(json);
      }
    } catch (error) {
      handleError(error);
    }
  });

// Register all commands above before parsing argv

// Stats
program
  .command('stats')
  .description('Show graph and tag statistics')
  .option('--json', 'Emit JSON output')
  .option('--top <n>', 'Top N tags/pairs to show', toNumber, 10)
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const edges = await listEdges('accepted');
      const graph = await buildGraph();

      const degrees = nodes.map((n) => (graph.hasNode(n.id) ? graph.degree(n.id) : 0));
      const degSorted = [...degrees].sort((a, b) => a - b);
      const sum = degrees.reduce((a, b) => a + b, 0);
      const avg = degrees.length ? sum / degrees.length : 0;
      const median = degSorted.length ? degSorted[Math.floor(degSorted.length / 2)] : 0;
      const p90 = degSorted.length ? degSorted[Math.floor(degSorted.length * 0.9)] : 0;

      const tagCounts = new Map<string, number>();
      const pairCounts = new Map<string, number>();
      for (const n of nodes) {
        const tags = Array.from(new Set(n.tags));
        for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
        for (let i = 0; i < tags.length; i += 1) {
          for (let j = i + 1; j < tags.length; j += 1) {
            const a = tags[i];
            const b = tags[j];
            const key = a < b ? `${a}::${b}` : `${b}::${a}`;
            pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
          }
        }
      }
      const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, options.top);
      const topPairs = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, options.top);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              counts: { nodes: nodes.length, edges: edges.length },
              degree: { avg, median, p90, max: Math.max(0, ...degrees) },
              tags: topTags.map(([tag, count]) => ({ tag, count })),
              tagPairs: topPairs.map(([pair, count]) => ({ pair, count })),
            },
            null,
            2,
          ),
        );
        return;
      }
      console.log('forest stats');
      console.log(`Nodes: ${nodes.length}`);
      console.log(`Accepted edges: ${edges.length}`);
      console.log('');
      console.log(`Degree — avg ${avg.toFixed(2)}  median ${median}  p90 ${p90}  max ${Math.max(0, ...degrees)}`);
      console.log('');
      if (topTags.length) {
        console.log('Top tags:');
        topTags.forEach(([t, c]) => console.log(`  ${String(c).padStart(3, ' ')}  ${t}`));
        console.log('');
      }
      if (topPairs.length) {
        console.log('Top tag pairs:');
        topPairs.forEach(([p, c]) => console.log(`  ${String(c).padStart(3, ' ')}  ${p.replace('::', ' + ')}`));
      }
    } catch (error) {
      handleError(error);
    }
  });

type ExploreRenderOptions = {
  selection?: SelectionResult;
  id?: string;
  limit: number;
  matchLimit?: number;
  depth: number;
  includeSuggestions: boolean;
  longIds: boolean;
  json: boolean;
  showMatches: boolean;
  focusSelected: boolean;
  suppressOverview?: boolean;
};

async function printExplore(options: ExploreRenderOptions) {
  let selection = options.selection;
  if (!selection) {
    if (!options.id) {
      throw new Error('No node id provided for explore output.');
    }
    selection = await selectNode({ id: options.id });
  }

  const match = selection.selected;
  const matches = selection.matches;
  const focusSelected = options.focusSelected ?? true;

  const neighborhoodData = await buildNeighborhoodPayload(match.node.id, options.depth, options.limit);
  const suggestionData = await fetchSuggestionsForNode(match.node.id);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          search: matches.map((entry) => serializeMatch(entry)),
          selected: serializeMatch(match),
          neighborhood: neighborhoodData.payload,
          suggestions: suggestionData.map((suggestion) => ({
            id: suggestion.id,
            score: suggestion.score,
            otherId: suggestion.otherId,
            otherTitle: suggestion.otherTitle,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  if (options.showMatches) {
    const matchLimit =
      typeof options.matchLimit === 'number' && !Number.isNaN(options.matchLimit)
        ? options.matchLimit
        : typeof selection.limit === 'number'
        ? selection.limit
        : DEFAULT_MATCH_DISPLAY_LIMIT;
    printMatches(matches, match, { longIds: options.longIds, label: 'Matches', limit: matchLimit });
    if (!focusSelected) {
      return;
    }
    console.log('');
  } else if (!focusSelected) {
    return;
  }

  const directEdges = neighborhoodData.directEdges;
  const node = match.node;
  if (!options.suppressOverview) {
    printNodeOverview(node, directEdges, { longIds: options.longIds });
  }

  if (options.includeSuggestions && suggestionData.length > 0) {
    if (!options.suppressOverview) {
      console.log('');
    }
    console.log('suggested edges:');
    for (const suggestion of suggestionData) {
      const [sa, sb] = normalizeEdgePair(node.id, suggestion.otherId);
      const code = edgeShortCode(sa, sb);
      console.log(
        `  ${formatScore(suggestion.score)}  [${code}] ${formatId(suggestion.otherId, { long: options.longIds })}  ${suggestion.otherTitle}  (${suggestion.id})`
      );
    }
  }
}

function printNodeOverview(
  node: NodeRecord,
  directEdges: Array<{ otherId: string; otherTitle: string; score: number }>,
  options: { longIds: boolean }
) {
  console.log(`${formatId(node.id, { long: options.longIds })} ${node.title}`);
  if (node.tags.length > 0) {
    console.log(`tags: ${node.tags.join(', ')}`);
  }
  console.log(`created: ${node.createdAt}`);
  console.log(`updated: ${node.updatedAt}`);
  console.log('');

  if (directEdges.length > 0) {
    console.log('accepted edges:');
    for (const edge of directEdges) {
      console.log(
        `  ${formatScore(edge.score)}  ${formatId(edge.otherId, { long: options.longIds })}  ${edge.otherTitle}`
      );
    }
  } else {
    console.log('accepted edges: none');
  }
}

function printMatches(
  matches: SearchMatch[],
  _selected: SearchMatch,
  options: { longIds: boolean; label: string; limit: number }
) {
  if (matches.length === 0) return;
  console.log(options.label);
  const limit = Math.min(matches.length, options.limit ?? DEFAULT_MATCH_DISPLAY_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const entry = matches[index];
    const tags = entry.node.tags.length > 0 ? ` [${entry.node.tags.join(', ')}]` : '';
    console.log(
      `${index + 1}. ${formatScore(entry.score)}  ${formatId(entry.node.id, { long: options.longIds })}  ${
        entry.node.title
      }${tags}`
    );
  }
  if (matches.length > limit) {
    console.log(`  …and ${matches.length - limit} more`);
  }
}

async function buildNeighborhoodPayload(centerId: string, depth: number, limit: number) {
  const graph = await buildGraph();
  if (!graph.hasNode(centerId)) {
    return {
      payload: { center: centerId, nodes: [], edges: [] },
      directEdges: [] as Array<{ otherId: string; otherTitle: string; score: number }>,
    };
  }

  const neighborhood = collectNeighborhood(graph, centerId, depth, limit);
  const allNodes = await listNodes();
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));

  const payload = {
    center: centerId,
    nodes: neighborhood.nodes
      .filter((id) => nodeMap.has(id))
      .map((id) => {
        const node = nodeMap.get(id)!;
        return {
          id: node.id,
          title: node.title,
          tags: node.tags,
          snippet: node.body.slice(0, 280),
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        };
      }),
    edges: neighborhood.edges.map((edge) => ({
      id: edge.key,
      source: edge.source,
      target: edge.target,
      score: edge.attributes.score,
      status: edge.attributes.status,
    })),
  };

  const directEdges = payload.edges
    .filter((edge) => edge.source === centerId || edge.target === centerId)
    .map((edge) => {
      const otherId = edge.source === centerId ? edge.target : edge.source;
      const otherNode = nodeMap.get(otherId);
      return {
        otherId,
        otherTitle: otherNode ? otherNode.title : otherId,
        score: edge.score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return { payload, directEdges };
}

async function fetchSuggestionsForNode(nodeId: string) {
  const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
  return (await listEdges('suggested'))
    .filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId)
    .map((edge) => {
      const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      return {
        id: edge.id,
        score: edge.score,
        otherId,
        otherTitle: nodeMap.get(otherId)?.title ?? otherId,
      };
    })
    .sort((a, b) => b.score - a.score);
}

async function resolveNodeReference(ref: string): Promise<NodeRecord | null> {
  if (!ref) return null;
  if (isShortId(ref)) {
    const prefix = await resolveByIdPrefix(ref);
    if (prefix) return prefix;
  }
  const direct = await getNodeById(ref);
  if (direct) return direct;
  return null;
}

function describeSuggestion(
  edge: EdgeRecord,
  nodeMap: Map<string, NodeRecord>,
  options: { longIds?: boolean }
) {
  const longIds = Boolean(options.longIds);
  const sourceNode = nodeMap.get(edge.sourceId) ?? null;
  const targetNode = nodeMap.get(edge.targetId) ?? null;
  const shortSource = formatId(edge.sourceId);
  const shortTarget = formatId(edge.targetId);
  const sourceIdDisplay = formatId(edge.sourceId, { long: longIds });
  const targetIdDisplay = formatId(edge.targetId, { long: longIds });
  const edgeId = longIds ? edge.id : `${shortSource}::${shortTarget}`;
  const sourceLabel = sourceNode?.title ?? (longIds ? edge.sourceId : sourceIdDisplay);
  const targetLabel = targetNode?.title ?? (longIds ? edge.targetId : targetIdDisplay);
  const code = edgeShortCode(edge.sourceId, edge.targetId);
  return {
    edgeId,
    shortId: `${shortSource}::${shortTarget}`,
    code,
    sourceLabel,
    targetLabel,
    sourceTitle: sourceNode?.title ?? null,
    targetTitle: targetNode?.title ?? null,
  };
}

function resolveSuggestionReference(ref: string, suggestions: EdgeRecord[]): EdgeRecord | undefined {
  const normalized = ref.trim();
  if (normalized.length === 0) return undefined;

  if (/^\d+$/.test(normalized)) {
    const index = Number.parseInt(normalized, 10);
    if (index >= 1 && index <= suggestions.length) {
      return suggestions[index - 1];
    }
    return undefined;
  }

  const lowered = normalized.toLowerCase();
  return suggestions.find((edge) => {
    if (edge.id === normalized) return true;
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    if (shortId === lowered) return true;
    const code = edgeShortCode(edge.sourceId, edge.targetId).toLowerCase();
    return code === lowered && /[a-z]/.test(lowered);
  });
}

function resolveEdgeReference(ref: string, edges: EdgeRecord[]): EdgeRecord | undefined {
  const normalized = ref.trim();
  if (normalized.length === 0) return undefined;
  const lowered = normalized.toLowerCase();
  return edges.find((edge) => {
    if (edge.id === normalized) return true;
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    if (shortId === lowered) return true;
    const code = edgeShortCode(edge.sourceId, edge.targetId).toLowerCase();
    return code === lowered && /[a-z]/.test(lowered);
  });
}

async function resolveEdgePairFromRef(ref: string): Promise<[string, string] | null> {
  const normalized = ref.trim();
  if (!normalized) return null;
  // Try existing edges first
  const allEdges = await listEdges('all');
  const viaEdges = resolveEdgeReference(normalized, allEdges);
  if (viaEdges) return normalizeEdgePair(viaEdges.sourceId, viaEdges.targetId);

  // Try short pair form abcd::efgh
  if (normalized.includes('::')) {
    const [a, b] = normalized.split('::', 2);
    if (a && b) {
      const aNode = (isShortId(a) ? await resolveByIdPrefix(a) : await getNodeById(a)) ?? null;
      const bNode = (isShortId(b) ? await resolveByIdPrefix(b) : await getNodeById(b)) ?? null;
      if (aNode && bNode) return normalizeEdgePair(aNode.id, bNode.id);
    }
  }

  // Try 4-char code over edges and recent events
  if (/^[a-z0-9]{1,4}$/i.test(normalized) && /[a-z]/i.test(normalized)) {
    const codeLower = normalized.toLowerCase();
    for (const e of allEdges) {
      const code = edgeShortCode(e.sourceId, e.targetId).toLowerCase();
      if (code === codeLower) return normalizeEdgePair(e.sourceId, e.targetId);
    }
    const events = await listEdgeEvents(1000);
    for (const ev of events) {
      const code = edgeShortCode(ev.sourceId, ev.targetId).toLowerCase();
      if (code === codeLower) return normalizeEdgePair(ev.sourceId, ev.targetId);
    }
  }
  return null;
}

type SelectionResult = { selected: SearchMatch; matches: SearchMatch[]; limit: number };

type SelectionInput = {
  id?: string;
  title?: string;
  term?: string;
  limit?: number;
  select?: number;
  interactive?: boolean;
  tagsAll?: string[];
  tagsAny?: string[];
  since?: Date | null;
  until?: Date | null;
  sort?: 'score' | 'recent' | 'degree';
};

async function selectNode(input: SelectionInput): Promise<SelectionResult> {
  const searchLimit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  if (input.id) {
    let node = await getNodeById(input.id);
    if (!node && isShortId(input.id)) {
      const byPrefix = await resolveByIdPrefix(input.id);
      if (byPrefix) node = byPrefix;
    }
    if (!node) {
      throw new Error(`Node with id ${input.id} not found.`);
    }
    return { selected: { node, score: 1 }, matches: [{ node, score: 1 }], limit: 1 };
  }

  if (input.term && isShortId(input.term)) {
    const prefixMatch = await resolveByIdPrefix(input.term);
    if (prefixMatch) {
      return { selected: { node: prefixMatch, score: 1 }, matches: [{ node: prefixMatch, score: 1 }], limit: 1 };
    }
  }

  if (input.title) {
    const titleMatch = await findNodeByTitle(input.title);
    if (titleMatch) {
      return { selected: { node: titleMatch, score: 1 }, matches: [{ node: titleMatch, score: 1 }], limit: 1 };
    }
  }

  const term = input.title ?? input.term ?? '';
  const hasFilters = Boolean(
    (input.tagsAll && input.tagsAll.length) ||
      (input.tagsAny && input.tagsAny.length) ||
      input.since ||
      input.until ||
      (input.sort && input.sort !== 'score')
  );

  let matches: SearchMatch[] = [];
  if (!hasFilters && term) {
    matches = await searchNodes(term, searchLimit);
  } else {
    const all = await listNodes();
    const filtered = all.filter((node) => {
      if (input.tagsAll && input.tagsAll.length) {
        for (const t of input.tagsAll) if (!node.tags.includes(t)) return false;
      }
      if (input.tagsAny && input.tagsAny.length) {
        let ok = false;
        for (const t of input.tagsAny) if (node.tags.includes(t)) ok = true;
        if (!ok) return false;
      }
      if (input.since) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts < input.since.getTime()) return false;
      }
      if (input.until) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts >= input.until.getTime()) return false;
      }
      return true;
    });

    // If a term is provided, compute a simple score similar to searchNodes
    let scored: SearchMatch[];
    if (term) {
      const normalized = term.trim().toLowerCase();
      scored = filtered
        .map((node) => {
          const titleMatch = node.title.toLowerCase().includes(normalized);
          const tagMatch = node.tags.some((tag) => tag.toLowerCase().includes(normalized));
          const bodyMatch = node.body.toLowerCase().includes(normalized);
          const score = (titleMatch ? 3 : 0) + (tagMatch ? 2 : 0) + (bodyMatch ? 1 : 0);
          return { node, score } as SearchMatch;
        })
        .filter((e) => e.score > 0)
        .map((e) => ({ node: e.node, score: Math.min(1, e.score / 6) }));
    } else {
      // No term: produce recency-based fallback scores
      scored = filtered
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((node, index) => ({ node, score: Math.max(0.2, 1 - index / Math.max(1, filtered.length)) }));
    }

    // Sort
    let sorted = scored;
    if (input.sort === 'recent') {
      sorted = [...scored].sort(
        (a, b) => new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime(),
      );
    } else if (input.sort === 'degree') {
      const graph = await buildGraph();
      sorted = [...scored].sort((a, b) => {
        const da = graph.hasNode(a.node.id) ? graph.degree(a.node.id) : 0;
        const db = graph.hasNode(b.node.id) ? graph.degree(b.node.id) : 0;
        if (db !== da) return db - da;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    } else {
      // 'score' or undefined: sort by score desc, then recency
      sorted = [...scored].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    }

    matches = sorted.slice(0, searchLimit);
  }
  if (matches.length === 0) {
    const why = term ? `"${term}"` : 'filters';
    throw new Error(`No node matching ${why}.`);
  }

  let index = 0;
  if (typeof input.select === 'number') {
    index = input.select - 1;
    if (Number.isNaN(index) || index < 0 || index >= matches.length) {
      throw new Error(`Select value out of range (must be between 1 and ${matches.length}).`);
    }
  }

  if (input.interactive && matches.length > 1) {
    printMatches(matches, matches[index], { longIds: false, label: 'Matches', limit: searchLimit });
    console.log('Use --select <n> to choose a different match in automated workflows.');
  }

  return { selected: matches[index], matches, limit: searchLimit };
}

async function resolveBody(bodyOption?: string, fileOption?: string, stdinOption?: boolean): Promise<string> {
  if (bodyOption) return bodyOption;
  if (fileOption) {
    const filePath = path.resolve(fileOption);
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (stdinOption) {
    return readStdin();
  }
  return '';
}

async function linkAgainstExisting(newNode: NodeRecord, existing: NodeRecord[]) {
  let accepted = 0;
  let suggested = 0;
  for (const other of existing) {
    const { score, components } = computeScore(newNode, other);
    const status = classifyScore(score);
    if (status === 'discard') continue;
    const [sourceId, targetId] = normalizeEdgePair(newNode.id, other.id);
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      status,
      metadata: {
        components,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    if (status === 'accepted') accepted += 1;
    if (status === 'suggested') suggested += 1;
  }
  return { accepted, suggested };
}

function toNumber(value: string, defaultValue?: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  if (typeof defaultValue === 'number') return defaultValue;
  return NaN;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    process.stdin.resume();
  });
}

function edgeIdentifier(a: string, b: string): string {
  return `${a}::${b}`;
}

function formatId(id: string, options: { long?: boolean } = {}): string {
  if (options.long) return id;
  const segment = id.split('-')[0] ?? id;
  return segment.slice(0, SHORT_ID_LENGTH);
}

function formatScore(score: number): string {
  if (Number.isNaN(score)) return '   -';
  const clamped = Math.max(0, Math.min(1, score));
  return clamped.toFixed(2);
}

function edgeShortCode(a: string, b: string): string {
  // Stable 4-char base36 code derived from the normalized short pair
  const pair = `${formatId(a)}::${formatId(b)}`;
  let h = 0x811c9dc5 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < pair.length; i += 1) {
    h ^= pair.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // * 16777619
  }
  const base36 = h.toString(36);
  return base36.slice(-4).padStart(4, '0');
}

function isShortId(term: string): boolean {
  return /^[0-9a-f]{6,}$/i.test(term) && term.length <= SHORT_ID_LENGTH;
}

async function resolveByIdPrefix(prefix: string): Promise<NodeRecord | null> {
  const normalized = prefix.toLowerCase();
  const nodes = await listNodes();
  const matches = nodes.filter((node) => node.id.toLowerCase().startsWith(normalized));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    console.warn(`⚠ Multiple nodes share prefix ${prefix}. Use --id with the full identifier.`);
  }
  return null;
}

function serializeMatch(match: SearchMatch) {
  return {
    id: match.node.id,
    title: match.node.title,
    tags: match.node.tags,
    score: match.score,
    updatedAt: match.node.updatedAt,
  };
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(`✖ ${error.message}`);
  } else {
    console.error('✖ Unexpected error', error);
  }
  process.exitCode = 1;
}

function parseCsvList(value?: string): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length ? parts : undefined;
}

function parseDate(value?: string): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const v = value.trim();
  // Allow YYYY-MM-DD shorthand
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeSort(value?: string): 'score' | 'recent' | 'degree' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  if (v === 'recent' || v === 'score' || v === 'degree') return v as any;
  return undefined;
}

function escapeLabel(text: string): string {
  return String(text).replace(/"/g, '\\"');
}

// Parse argv after all commands are defined
program.parseAsync(process.argv);
