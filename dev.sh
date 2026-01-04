#!/usr/bin/env bash
# Unified development script for Forest CLI
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMBED_DIR="$SCRIPT_DIR/forest-embed"

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
  build [cli|embed|all]   Build projects
  test [cli|embed|all]    Run tests
  lint [cli|embed|all]    Run type checking
  clean [cli|embed|all]   Clean build artifacts
  install                 Install dependencies

Examples:
  ./dev.sh dev cli        Run CLI in dev mode
  ./dev.sh dev server     Run API server
  ./dev.sh build all      Build CLI and forest-embed
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

    info "Checking Rust toolchain..."
    if ! command -v cargo &> /dev/null; then
        error "Rust toolchain not found. Install from https://rustup.rs/"
        exit 1
    fi
    success "Rust toolchain found"
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
    case "${1:-all}" in
        cli)
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
        embed)
            info "Building forest-embed..."
            cd "$EMBED_DIR"
            cargo build --release
            success "forest-embed built at $EMBED_DIR/target/release/forest-embed"
            ;;
        all)
            cmd_build cli
            cmd_build embed
            success "All projects built successfully"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, embed, all"
            exit 1
            ;;
    esac
}

# Test commands
cmd_test() {
    case "${1:-all}" in
        cli)
            info "Running CLI tests..."
            cd "$SCRIPT_DIR"
            if [ -f "bun.lock" ]; then
                bun test
                success "CLI tests passed"
            else
                warn "No tests configured for CLI"
            fi
            ;;
        embed)
            info "Running forest-embed tests..."
            cd "$EMBED_DIR"
            cargo test
            success "forest-embed tests passed"
            ;;
        all)
            cmd_test cli
            cmd_test embed
            success "All tests passed"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, embed, all"
            exit 1
            ;;
    esac
}

# Lint commands
cmd_lint() {
    case "${1:-all}" in
        cli)
            info "Type-checking CLI..."
            cd "$SCRIPT_DIR"
            bun run lint
            success "CLI type-check passed"
            ;;
        embed)
            info "Checking forest-embed Rust code..."
            cd "$EMBED_DIR"
            cargo check
            success "forest-embed check passed"
            ;;
        all)
            cmd_lint cli
            cmd_lint embed
            success "All type-checks passed"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, embed, all"
            exit 1
            ;;
    esac
}

# Clean commands
cmd_clean() {
    case "${1:-all}" in
        cli)
            info "Cleaning CLI build artifacts..."
            cd "$SCRIPT_DIR"
            rm -rf dist/
            success "CLI cleaned"
            ;;
        embed)
            info "Cleaning forest-embed build artifacts..."
            cd "$EMBED_DIR"
            rm -rf target/
            success "forest-embed cleaned"
            ;;
        all)
            cmd_clean cli
            cmd_clean embed
            success "All build artifacts cleaned"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, embed, all"
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
