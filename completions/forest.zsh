#compdef forest
# Zsh completion for forest CLI
# Installation:
#   Copy to one of the directories in $fpath, or add to ~/.zshrc:
#   fpath=(path/to/forest/completions $fpath)
#   autoload -Uz compinit && compinit

_forest() {
    local -a commands node_cmds edge_cmds tag_cmds export_cmds recency_refs

    commands=(
        'capture:Create a new note and optionally auto-link into the graph'
        'explore:Explore the graph interactively'
        'search:Semantic search using embeddings'
        'node:Node operations (read, edit, delete, link, etc.)'
        'edges:Edge management (propose, accept, reject, etc.)'
        'tags:Tag operations (list, rename, stats)'
        'export:Export graph data (graphviz, json)'
        'stats:Graph statistics and health'
        'health:System health check'
        'admin\:recompute-embeddings:Recompute embeddings for all nodes'
        'serve:Start the Forest REST API server'
        '--help:Show help'
        '--version:Show version'
        '--tldr:Show TLDR documentation'
    )

    node_cmds=(
        'read:Show the full content of a note'
        'edit:Edit an existing note'
        'delete:Delete a note'
        'link:Create a link between two notes'
        'recent:Show recently created or updated nodes'
        'synthesize:Synthesize multiple nodes into a new coherent note'
        'import:Import a long document, chunking it into connected nodes'
    )

    edge_cmds=(
        'propose:List suggested links for review'
        'accept:Accept a suggested link'
        'reject:Reject a suggested link'
        'promote:Bulk accept edges above a score threshold'
        'sweep:Bulk reject edges by score range'
        'explain:Explain the scoring for an edge'
        'undo:Undo a previous accept or reject action'
    )

    tag_cmds=(
        'list:List all tags'
        'rename:Rename a tag'
        'stats:Show tag statistics'
    )

    export_cmds=(
        'graphviz:Export as DOT format for Graphviz'
        'json:Export as JSON'
    )

    recency_refs=(
        '@:Most recently updated node'
        '@1:Second most recently updated node'
        '@2:Third most recently updated node'
        '@3:Fourth most recently updated node'
        '@4:Fifth most recently updated node'
        '@5:Sixth most recently updated node'
    )

    local curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \
        '1: :->command' \
        '*::arg:->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[1] in
                node)
                    _arguments -C \
                        '1: :->subcmd' \
                        '*::arg:->subargs'

                    case $state in
                        subcmd)
                            _describe 'node subcommand' node_cmds
                            ;;
                        subargs)
                            # Suggest recency refs for node operations
                            if [[ $PREFIX == @* ]]; then
                                _describe 'recency reference' recency_refs
                            fi
                            ;;
                    esac
                    ;;
                edges)
                    _arguments -C \
                        '1: :->subcmd' \
                        '*::arg:->subargs'

                    case $state in
                        subcmd)
                            _describe 'edges subcommand' edge_cmds
                            ;;
                    esac
                    ;;
                tags)
                    _arguments -C \
                        '1: :->subcmd' \
                        '*::arg:->subargs'

                    case $state in
                        subcmd)
                            _describe 'tags subcommand' tag_cmds
                            ;;
                    esac
                    ;;
                export)
                    _arguments -C \
                        '1: :->subcmd' \
                        '*::arg:->subargs'

                    case $state in
                        subcmd)
                            _describe 'export subcommand' export_cmds
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac
}

_forest "$@"
