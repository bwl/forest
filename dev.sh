#!/usr/bin/env bash
# Unified development script for Forest CLI
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

show_help() {
    cat << EOF
Forest Development Script

Usage: ./dev.sh [COMMAND] [TARGET]

Commands:
  dev [cli|server]        Run in development mode
  build [cli|all]         Build projects
  test [cli|all]          Run tests
  lint [cli|all]          Run type checking
  clean [cli|all]         Clean build artifacts
  install                 Install dependencies

Examples:
  ./dev.sh dev cli        Run CLI in dev mode
  ./dev.sh dev server     Run API server
  ./dev.sh build all      Build CLI
  ./dev.sh test cli       Run CLI tests
  ./dev.sh lint cli       Type-check CLI

EOF
}

# Install dependencies
cmd_install() {
    info "Installing CLI dependencies..."
    cd "$SCRIPT_DIR"
    bun install
    success "CLI dependencies installed"
}

# Development commands
cmd_dev() {
    case "${1:-cli}" in
        cli)
            info "Running CLI in dev mode..."
            cd "$SCRIPT_DIR"
            bun run dev "${@:2}"
            ;;
        server)
            info "Running API server in dev mode..."
            cd "$SCRIPT_DIR"
            bun run dev:server
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, server"
            exit 1
            ;;
    esac
}

# Build commands
cmd_build() {
    case "${1:-cli}" in
        cli|all)
            info "Building CLI..."
            cd "$SCRIPT_DIR"

            # Check if dependencies are installed
            if [ ! -d "node_modules" ]; then
                info "Dependencies not found, installing..."
                bun install
            fi

            bun run build
            success "CLI built successfully"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, all"
            exit 1
            ;;
    esac
}

# Test commands
cmd_test() {
    case "${1:-cli}" in
        cli|all)
            info "Running CLI tests..."
            cd "$SCRIPT_DIR"
            if [ -f "bun.lock" ]; then
                bun test
                success "CLI tests passed"
            else
                warn "No tests configured for CLI"
            fi
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, all"
            exit 1
            ;;
    esac
}

# Lint commands
cmd_lint() {
    case "${1:-cli}" in
        cli|all)
            info "Type-checking CLI..."
            cd "$SCRIPT_DIR"
            bun run lint
            success "CLI type-check passed"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, all"
            exit 1
            ;;
    esac
}

# Clean commands
cmd_clean() {
    case "${1:-cli}" in
        cli|all)
            info "Cleaning CLI build artifacts..."
            cd "$SCRIPT_DIR"
            rm -rf dist/
            success "CLI cleaned"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, all"
            exit 1
            ;;
    esac
}

# Main command dispatcher
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    case "$1" in
        dev)
            cmd_dev "${@:2}"
            ;;
        build)
            cmd_build "${@:2}"
            ;;
        test)
            cmd_test "${@:2}"
            ;;
        lint)
            cmd_lint "${@:2}"
            ;;
        clean)
            cmd_clean "${@:2}"
            ;;
        install)
            cmd_install
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
