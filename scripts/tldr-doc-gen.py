#!/usr/bin/env python3
"""
tldr-doc-gen.py - Universal TLDR v0.1 Documentation Generator (Python)

Generates comprehensive documentation and analytics for any CLI implementing
the TLDR standard. Focus on data analysis, statistics, and validation.

Usage:
    ./tldr-doc-gen.py <cli-command> [--validate|--analyze|--html]

Examples:
    ./tldr-doc-gen.py forest
    ./tldr-doc-gen.py forest --validate
    ./tldr-doc-gen.py forest --analyze
    ./tldr-doc-gen.py forest --html
    ./tldr-doc-gen.py git  # (if git implemented TLDR)

Output Files:
    <cli>_tldr_analytics.json - Structured data with embedded analytics
    <cli>_tldr_report.html - Optional visual report (with --html)

Features:
    - Statistics: flag type distribution, command hierarchy, coverage metrics
    - Validation suite with detailed error reporting
    - Optional HTML report generation
    - Analytics embedded in JSON output
    - Dependency graph analysis
    - Coverage and completeness metrics
"""

import subprocess
import json
import sys
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple

# ============================================================================
# Core Functions
# ============================================================================

def exec_command(cmd: List[str], allow_failure: bool = False) -> Optional[str]:
    """Execute shell command and return output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        if allow_failure:
            return None
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{e.stderr}")
    except FileNotFoundError:
        if allow_failure:
            return None
        raise RuntimeError(f"Command not found: {cmd[0]}")


def is_command_available(cli: str) -> bool:
    """Check if CLI command is available."""
    return shutil.which(cli) is not None


def parse_ascii_tldr(ascii: str) -> Dict[str, str]:
    """Parse ASCII TLDR format to dictionary."""
    parsed = {}
    for line in ascii.split('\n'):
        if ':' in line:
            parts = line.split(':', 1)
            if len(parts) == 2:
                key, value = parts
                key = key.strip()
                if key.isupper() or key.replace('_', '').isupper():
                    parsed[key] = value.strip()
    return parsed


def parse_flags(flags_string: str) -> List[Dict[str, Any]]:
    """Parse FLAGS field into structured list."""
    if not flags_string:
        return []

    flags = []
    for flag in flags_string.split(';'):
        flag = flag.strip()
        if not flag or '|' not in flag:
            continue

        parts = flag.split('|', 1)
        if len(parts) < 2:
            continue

        signature, description = parts
        signature = signature.strip()

        # Parse --name=TYPE=default format
        if signature.startswith('--'):
            flag_parts = signature[2:].split('=')
            name = flag_parts[0]
            flag_type = flag_parts[1] if len(flag_parts) > 1 else 'BOOL'
            default = flag_parts[2] if len(flag_parts) > 2 else None

            flags.append({
                'name': name,
                'type': flag_type,
                'default': default,
                'description': description.strip()
            })

    return flags


def parse_examples(examples_string: str) -> List[str]:
    """Parse EXAMPLES field into list."""
    if not examples_string:
        return []
    return [ex.strip() for ex in examples_string.split('|') if ex.strip()]


def parse_related(related_string: str) -> List[str]:
    """Parse RELATED field into list."""
    if not related_string:
        return []
    return [r.strip() for r in related_string.split(',') if r.strip()]


# ============================================================================
# TLDR Fetching
# ============================================================================

def fetch_global_tldr(cli: str) -> Tuple[str, Dict[str, str]]:
    """Fetch and parse global TLDR index."""
    ascii = exec_command([cli, '--tldr'])
    parsed = parse_ascii_tldr(ascii)
    return ascii, parsed


def fetch_command_tldr(cli: str, command: str) -> Tuple[Optional[str], Optional[Dict[str, str]]]:
    """Fetch and parse command TLDR."""
    # Convert dot notation to space (e.g., "node.read" -> "node read")
    cmd_args = command.replace('.', ' ').split()
    full_cmd = [cli] + cmd_args + ['--tldr']

    ascii = exec_command(full_cmd, allow_failure=True)
    if ascii is None:
        return None, None

    parsed = parse_ascii_tldr(ascii)
    return ascii, parsed


# ============================================================================
# Validation
# ============================================================================

def validate_global_index(parsed: Dict[str, str]) -> Tuple[List[str], List[str]]:
    """Validate global TLDR index."""
    errors = []
    warnings = []

    required_fields = ['NAME', 'VERSION', 'SUMMARY', 'COMMANDS']
    for field in required_fields:
        if field not in parsed or not parsed[field]:
            errors.append(f"Missing required field: {field}")

    return errors, warnings


def validate_command_tldr(
    command: str,
    ascii: Optional[str],
    parsed: Optional[Dict[str, str]]
) -> Tuple[List[str], List[str]]:
    """Validate command TLDR format."""
    errors = []
    warnings = []

    if ascii is None or parsed is None:
        errors.append(f"Command '{command}' is not accessible")
        return errors, warnings

    # Check required fields
    required_fields = ['CMD', 'PURPOSE']
    for field in required_fields:
        if field not in parsed or not parsed[field]:
            errors.append(f"Missing required field: {field}")

    # Validate CMD matches command name
    if parsed.get('CMD') and parsed['CMD'] != command:
        warnings.append(
            f"CMD field mismatch: expected '{command}', got '{parsed['CMD']}'"
        )

    return errors, warnings


def validate_tldr_compliance(cli: str) -> Dict[str, Any]:
    """Comprehensive TLDR compliance validation."""
    print(f"ℹ Validating TLDR compliance for '{cli}'...")

    # Fetch global index
    try:
        global_ascii, global_parsed = fetch_global_tldr(cli)
    except Exception as e:
        return {
            'success': False,
            'error': f"Failed to fetch global TLDR: {str(e)}"
        }

    # Validate global index
    global_errors, global_warnings = validate_global_index(global_parsed)

    if global_errors:
        return {
            'success': False,
            'globalErrors': global_errors,
            'globalWarnings': global_warnings
        }

    # Parse commands list
    commands_str = global_parsed.get('COMMANDS', '')
    commands = [c.strip() for c in commands_str.split(',') if c.strip()]

    print(f"ℹ Found {len(commands)} commands to validate")

    # Validate each command
    accessible_count = 0
    failed_count = 0
    command_results = {}

    for command in commands:
        ascii, parsed = fetch_command_tldr(cli, command)
        errors, warnings = validate_command_tldr(command, ascii, parsed)

        if ascii is not None:
            accessible_count += 1

        if errors:
            failed_count += 1

        if errors or warnings:
            command_results[command] = {
                'errors': errors,
                'warnings': warnings
            }

    # Build validation report
    total_errors = len(global_errors) + sum(
        len(r['errors']) for r in command_results.values()
    )
    total_warnings = len(global_warnings) + sum(
        len(r['warnings']) for r in command_results.values()
    )

    return {
        'success': total_errors == 0 and failed_count == 0,
        'cli': global_parsed.get('NAME'),
        'version': global_parsed.get('VERSION'),
        'totalCommands': len(commands),
        'accessibleCommands': accessible_count,
        'failedCommands': failed_count,
        'globalErrors': global_errors,
        'globalWarnings': global_warnings,
        'commandResults': command_results,
        'totalErrors': total_errors,
        'totalWarnings': total_warnings
    }


# ============================================================================
# Analytics
# ============================================================================

def categorize_by_namespace(commands: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Categorize commands by namespace."""
    categories = {
        'top-level': []
    }

    for cmd in commands:
        name = cmd['name']
        if '.' in name:
            namespace = name.split('.')[0]
            if namespace not in categories:
                categories[namespace] = []
            categories[namespace].append(name)
        else:
            categories['top-level'].append(name)

    return categories


def analyze_flag_types(commands: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze flag type distribution."""
    type_counter = Counter()
    total_flags = 0

    for cmd in commands:
        flags = parse_flags(cmd.get('flags', ''))
        total_flags += len(flags)

        for flag in flags:
            type_counter[flag['type']] += 1

    return {
        'distribution': dict(type_counter),
        'total': total_flags,
        'averagePerCommand': round(total_flags / len(commands), 2) if commands else 0,
        'mostCommonType': type_counter.most_common(1)[0][0] if type_counter else None
    }


def build_dependency_graph(commands: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build dependency graph from RELATED fields."""
    outgoing = {}
    incoming = defaultdict(list)

    for cmd in commands:
        name = cmd['name']
        related = parse_related(cmd.get('related', ''))
        outgoing[name] = related

        for rel in related:
            incoming[rel].append(name)

    # Calculate centrality (total edges)
    centrality = {}
    for cmd in commands:
        name = cmd['name']
        out_count = len(outgoing.get(name, []))
        in_count = len(incoming.get(name, []))
        centrality[name] = out_count + in_count

    # Find most connected
    most_connected = sorted(
        centrality.items(),
        key=lambda x: x[1],
        reverse=True
    )[:10]

    return {
        'outgoing': outgoing,
        'incoming': dict(incoming),
        'centrality': centrality,
        'mostConnected': [
            {
                'command': cmd,
                'centrality': cent,
                'outgoing': len(outgoing.get(cmd, [])),
                'incoming': len(incoming.get(cmd, []))
            }
            for cmd, cent in most_connected if cent > 0
        ]
    }


def calculate_coverage(commands: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate documentation coverage metrics."""
    total = len(commands)
    with_examples = sum(1 for c in commands if c.get('examples'))
    with_related = sum(1 for c in commands if c.get('related'))
    with_schema = sum(1 for c in commands if c.get('schemaJson'))
    with_side_effects = sum(1 for c in commands if c.get('sideEffects'))
    with_flags = sum(1 for c in commands if c.get('flags'))

    return {
        'total': total,
        'withExamples': with_examples,
        'withExamplesPercent': round(with_examples / total * 100, 1) if total else 0,
        'withRelated': with_related,
        'withRelatedPercent': round(with_related / total * 100, 1) if total else 0,
        'withSchema': with_schema,
        'withSchemaPercent': round(with_schema / total * 100, 1) if total else 0,
        'withSideEffects': with_side_effects,
        'withSideEffectsPercent': round(with_side_effects / total * 100, 1) if total else 0,
        'withFlags': with_flags,
        'withFlagsPercent': round(with_flags / total * 100, 1) if total else 0
    }


def analyze_commands(cli_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate comprehensive analytics."""
    commands = cli_data['commands']

    return {
        'totalCommands': len(commands),
        'commandHierarchy': categorize_by_namespace(commands),
        'flagTypeDistribution': analyze_flag_types(commands),
        'coverage': calculate_coverage(commands),
        'dependencyGraph': build_dependency_graph(commands)
    }


# ============================================================================
# HTML Report Generation
# ============================================================================

def generate_html_report(data: Dict[str, Any], output_file: str):
    """Generate HTML visualization report."""
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{data['metadata']['name']} v{data['metadata']['version']} - TLDR Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5em;
        }}
        .header p {{
            margin: 10px 0 0 0;
            opacity: 0.9;
        }}
        .section {{
            background: white;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .section h2 {{
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        .metric {{
            display: inline-block;
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 5px;
            margin: 10px 10px 10px 0;
            border-left: 4px solid #667eea;
        }}
        .metric-label {{
            font-size: 0.85em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .metric-value {{
            font-size: 1.8em;
            font-weight: bold;
            color: #333;
        }}
        .bar {{
            height: 30px;
            background: #667eea;
            border-radius: 5px;
            margin: 5px 0;
            display: flex;
            align-items: center;
            padding: 0 10px;
            color: white;
            font-weight: 500;
        }}
        .bar-container {{
            margin: 15px 0;
        }}
        .bar-label {{
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        th, td {{
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        code {{
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }}
        .tag {{
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.85em;
            margin-right: 5px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{data['metadata']['name']} v{data['metadata']['version']}</h1>
        <p>{data['metadata']['summary']}</p>
        <p style="font-size: 0.9em; margin-top: 15px;">
            Generated: {data['metadata']['generated']} | TLDR Spec: v0.1
        </p>
    </div>

    <div class="section">
        <h2>Overview</h2>
        <div class="metric">
            <div class="metric-label">Total Commands</div>
            <div class="metric-value">{data['analytics']['totalCommands']}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Namespaces</div>
            <div class="metric-value">{len(data['analytics']['commandHierarchy']) - 1}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Total Flags</div>
            <div class="metric-value">{data['analytics']['flagTypeDistribution']['total']}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Avg Flags/Command</div>
            <div class="metric-value">{data['analytics']['flagTypeDistribution']['averagePerCommand']}</div>
        </div>
    </div>

    <div class="section">
        <h2>Coverage Metrics</h2>
        <div class="bar-container">
            <span class="bar-label">Commands with Examples</span>
            <div class="bar" style="width: {data['analytics']['coverage']['withExamplesPercent']}%">
                {data['analytics']['coverage']['withExamplesPercent']}% ({data['analytics']['coverage']['withExamples']}/{data['analytics']['coverage']['total']})
            </div>
        </div>
        <div class="bar-container">
            <span class="bar-label">Commands with Related Links</span>
            <div class="bar" style="width: {data['analytics']['coverage']['withRelatedPercent']}%">
                {data['analytics']['coverage']['withRelatedPercent']}% ({data['analytics']['coverage']['withRelated']}/{data['analytics']['coverage']['total']})
            </div>
        </div>
        <div class="bar-container">
            <span class="bar-label">Commands with Schema</span>
            <div class="bar" style="width: {data['analytics']['coverage']['withSchemaPercent']}%">
                {data['analytics']['coverage']['withSchemaPercent']}% ({data['analytics']['coverage']['withSchema']}/{data['analytics']['coverage']['total']})
            </div>
        </div>
        <div class="bar-container">
            <span class="bar-label">Commands with Side Effects</span>
            <div class="bar" style="width: {data['analytics']['coverage']['withSideEffectsPercent']}%">
                {data['analytics']['coverage']['withSideEffectsPercent']}% ({data['analytics']['coverage']['withSideEffects']}/{data['analytics']['coverage']['total']})
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Flag Type Distribution</h2>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
"""

    flag_dist = data['analytics']['flagTypeDistribution']['distribution']
    total_flags = data['analytics']['flagTypeDistribution']['total']
    for flag_type, count in sorted(flag_dist.items(), key=lambda x: x[1], reverse=True):
        percent = round(count / total_flags * 100, 1) if total_flags else 0
        html += f"""
                <tr>
                    <td><code>{flag_type}</code></td>
                    <td>{count}</td>
                    <td>{percent}%</td>
                </tr>
"""

    html += """
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Command Hierarchy</h2>
        <table>
            <thead>
                <tr>
                    <th>Namespace</th>
                    <th>Commands</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
"""

    hierarchy = data['analytics']['commandHierarchy']
    for namespace, cmds in sorted(hierarchy.items(), key=lambda x: len(x[1]), reverse=True):
        cmd_tags = ' '.join([f'<span class="tag">{cmd}</span>' for cmd in sorted(cmds)[:5]])
        more = len(cmds) - 5
        if more > 0:
            cmd_tags += f' <span class="tag">+{more} more</span>'
        html += f"""
                <tr>
                    <td><strong>{namespace}</strong></td>
                    <td>{cmd_tags}</td>
                    <td>{len(cmds)}</td>
                </tr>
"""

    html += """
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Most Connected Commands</h2>
        <table>
            <thead>
                <tr>
                    <th>Command</th>
                    <th>Total Connections</th>
                    <th>Outgoing</th>
                    <th>Incoming</th>
                </tr>
            </thead>
            <tbody>
"""

    most_connected = data['analytics']['dependencyGraph']['mostConnected']
    for cmd_info in most_connected[:10]:
        html += f"""
                <tr>
                    <td><code>{cmd_info['command']}</code></td>
                    <td><strong>{cmd_info['centrality']}</strong></td>
                    <td>{cmd_info['outgoing']}</td>
                    <td>{cmd_info['incoming']}</td>
                </tr>
"""

    html += f"""
            </tbody>
        </table>
    </div>

    <div class="section" style="text-align: center; color: #666; font-size: 0.9em;">
        <p>Generated by <strong>tldr-doc-gen.py</strong> (TLDR v0.1 Universal Generator)</p>
    </div>
</body>
</html>
"""

    with open(output_file, 'w') as f:
        f.write(html)


# ============================================================================
# Main Logic
# ============================================================================

def main():
    if len(sys.argv) < 2:
        print('Usage: tldr-doc-gen.py <cli-command> [--validate|--analyze|--html]')
        print('')
        print('Examples:')
        print('  tldr-doc-gen.py forest')
        print('  tldr-doc-gen.py forest --validate')
        print('  tldr-doc-gen.py forest --analyze')
        print('  tldr-doc-gen.py forest --html')
        sys.exit(1)

    cli = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else None

    # Check if CLI is available
    if not is_command_available(cli):
        print(f"✖ Error: '{cli}' command not found")
        sys.exit(1)

    # Validation mode
    if mode == '--validate':
        validation = validate_tldr_compliance(cli)

        print('')
        print('=' * 50)
        print('VALIDATION SUMMARY')
        print('=' * 50)
        print(f"ℹ CLI: {validation.get('cli')} v{validation.get('version')}")
        print(f"ℹ Total commands: {validation['totalCommands']}")
        print(f"✔ Accessible commands: {validation['accessibleCommands']}")

        if validation['failedCommands'] > 0:
            print(f"✖ Failed commands: {validation['failedCommands']}")

        if validation['totalErrors'] > 0:
            print(f"✖ Validation errors: {validation['totalErrors']}")

        if validation['totalWarnings'] > 0:
            print(f"⚠ Validation warnings: {validation['totalWarnings']}")

        # Show detailed errors
        if validation.get('commandResults'):
            print('')
            print('Command Issues:')
            for cmd, results in validation['commandResults'].items():
                if results['errors']:
                    print(f"  ✖ {cmd}:")
                    for err in results['errors']:
                        print(f"    - {err}")
                if results['warnings']:
                    print(f"  ⚠ {cmd}:")
                    for warn in results['warnings']:
                        print(f"    - {warn}")

        print('')
        if validation['success']:
            print(f"✔ {validation['cli']} is TLDR v0.1 compliant ✨")
            sys.exit(0)
        else:
            print(f"✖ {validation['cli']} has validation failures")
            sys.exit(1)

    # Documentation generation mode
    print(f"ℹ Fetching TLDR data from '{cli}'...")

    try:
        global_ascii, global_parsed = fetch_global_tldr(cli)
    except Exception as e:
        print(f"✖ Failed to fetch global TLDR: {str(e)}")
        sys.exit(1)

    name = global_parsed.get('NAME', '')
    version = global_parsed.get('VERSION', '')
    summary = global_parsed.get('SUMMARY', '')
    commands_str = global_parsed.get('COMMANDS', '')

    # Parse commands
    commands = [c.strip() for c in commands_str.split(',') if c.strip()]
    print(f"ℹ Found {len(commands)} commands")

    # Fetch all command details
    print('ℹ Fetching command details...')
    command_data = []

    for command in commands:
        ascii, parsed = fetch_command_tldr(cli, command)

        if parsed:
            command_data.append({
                'name': command,
                'purpose': parsed.get('PURPOSE', ''),
                'inputs': parsed.get('INPUTS', ''),
                'outputs': parsed.get('OUTPUTS', ''),
                'sideEffects': parsed.get('SIDE_EFFECTS', ''),
                'flags': parsed.get('FLAGS', ''),
                'examples': parsed.get('EXAMPLES', ''),
                'related': parsed.get('RELATED', ''),
                'schemaJson': parsed.get('SCHEMA_JSON', ''),
                'ascii': ascii
            })
        else:
            print(f"⚠ Failed to fetch TLDR for command '{command}'")

    # Build complete data structure
    data = {
        'metadata': {
            'name': name,
            'version': version,
            'summary': summary,
            'generated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'tldrSpec': 'v0.1',
            'totalCommands': len(command_data)
        },
        'globalIndex': global_parsed,
        'commands': command_data,
        'analytics': analyze_commands({'commands': command_data}),
        'generatedBy': 'tldr-doc-gen.py (TLDR v0.1 Universal Generator)'
    }

    # Generate JSON output
    json_output = f"{cli}_tldr_analytics.json"
    with open(json_output, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"✔ Generated: {json_output}")

    # Analyze mode - print statistics
    if mode == '--analyze':
        analytics = data['analytics']
        print('')
        print('=' * 50)
        print('ANALYTICS REPORT')
        print('=' * 50)
        print(f"\nTotal Commands: {analytics['totalCommands']}")

        print('\nCommand Hierarchy:')
        for namespace, cmds in sorted(
            analytics['commandHierarchy'].items(),
            key=lambda x: len(x[1]),
            reverse=True
        ):
            print(f"  {namespace}: {len(cmds)} commands")

        print('\nFlag Type Distribution:')
        for flag_type, count in sorted(
            analytics['flagTypeDistribution']['distribution'].items(),
            key=lambda x: x[1],
            reverse=True
        ):
            print(f"  {flag_type}: {count}")

        print(f"\nCoverage Metrics:")
        cov = analytics['coverage']
        print(f"  Examples: {cov['withExamplesPercent']}% ({cov['withExamples']}/{cov['total']})")
        print(f"  Related: {cov['withRelatedPercent']}% ({cov['withRelated']}/{cov['total']})")
        print(f"  Schema: {cov['withSchemaPercent']}% ({cov['withSchema']}/{cov['total']})")
        print(f"  Side Effects: {cov['withSideEffectsPercent']}% ({cov['withSideEffects']}/{cov['total']})")

        print('\nMost Connected Commands:')
        for cmd_info in analytics['dependencyGraph']['mostConnected'][:5]:
            print(f"  {cmd_info['command']}: {cmd_info['centrality']} connections " +
                  f"({cmd_info['outgoing']} out, {cmd_info['incoming']} in)")

    # HTML mode
    if mode == '--html':
        html_output = f"{cli}_tldr_report.html"
        generate_html_report(data, html_output)
        print(f"✔ Generated: {html_output}")

    print('')
    print('✔ Done! Analytics generated successfully.')


if __name__ == '__main__':
    main()
