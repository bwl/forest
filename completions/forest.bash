#!/usr/bin/env bash
# Bash completion for forest CLI
# Installation:
#   source completions/forest.bash
# Or add to ~/.bashrc:
#   source /path/to/forest/completions/forest.bash

_forest_complete() {
    local cur prev words cword
    _init_completion || return

    # Top-level commands
    local commands="capture write explore link path search node edges tags documents export stats admin config serve version --help --version --tldr"

    # Subcommands for node
    local node_commands="read update edit delete connect synthesize import"

    # Subcommands for edges
    local edges_commands="explain threshold"

    # Subcommands for tags
    local tags_commands="add remove list rename stats"

    # Subcommands for documents
    local documents_commands="list show stats"

    # Subcommands for admin
    local admin_commands="migrate-v2 embeddings tags health doctor"

    # Subcommands for export
    local export_commands="graphviz json"

    # Handle subcommands
    if [[ ${cword} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
        return 0
    fi

    local subcmd="${words[1]}"

    case "${subcmd}" in
        node)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${node_commands}" -- "${cur}"))
                return 0
            fi
            ;;
        edges)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${edges_commands}" -- "${cur}"))
                return 0
            fi
            ;;
        tags)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${tags_commands}" -- "${cur}"))
                return 0
            fi
            ;;
        documents)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${documents_commands}" -- "${cur}"))
                return 0
            fi
            ;;
        admin)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${admin_commands}" -- "${cur}"))
                return 0
            fi
            ;;
        export)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${export_commands}" -- "${cur}"))
                return 0
            fi
            ;;
    esac

    # Suggest recency references (@, @1, @2) for commands that take node refs
    case "${subcmd}" in
        explore|node|link|tags)
            if [[ ${cur} == @* ]]; then
                COMPREPLY=($(compgen -W "@ @1 @2 @3 @4 @5" -- "${cur}"))
                return 0
            fi
            ;;
    esac

    # Suggest tag references (#tag) - would need to query forest db, skipping for now
    # Suggest flags based on context
    case "${prev}" in
        --title|--body|--tags|--file)
            # These expect values, no completion
            return 0
            ;;
        *)
            # Suggest common flags
            local flags="--help --json --tldr --long-ids"
            COMPREPLY=($(compgen -W "${flags}" -- "${cur}"))
            ;;
    esac
}

complete -F _forest_complete forest
