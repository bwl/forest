#!/usr/bin/env bash
# Unified development script for Forest CLI and Desktop
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR/forest-desktop"

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
  dev [cli|desktop|server]  Run in development mode
  build [cli|desktop|all]   Build projects
  test [cli|desktop|all]    Run tests
  lint [cli|desktop|all]    Run type checking
  clean [cli|desktop|all]   Clean build artifacts
  install                   Install dependencies for both projects

Examples:
  ./dev.sh dev cli          Run CLI in dev mode
  ./dev.sh dev desktop      Run desktop app in dev mode
  ./dev.sh dev server       Run API server
  ./dev.sh build all        Build both CLI and desktop
  ./dev.sh test all         Run all tests
  ./dev.sh lint all         Type-check both projects

EOF
}

# Install dependencies
cmd_install() {
    info "Installing CLI dependencies..."
    cd "$SCRIPT_DIR"
    bun install
    success "CLI dependencies installed"

    info "Installing desktop dependencies..."
    cd "$DESKTOP_DIR"
    bun install
    success "Desktop dependencies installed"

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
        desktop)
            info "Running desktop app in dev mode..."
            cd "$DESKTOP_DIR"
            bun run tauri dev
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, server, desktop"
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
        desktop)
            info "Building desktop app..."
            cd "$DESKTOP_DIR"

            # Check if dependencies are installed
            if [ ! -d "node_modules" ]; then
                info "Dependencies not found, installing..."
                bun install
            fi

            # Build Rust backend first
            info "Building Rust backend..."
            cd "$DESKTOP_DIR/src-tauri"
            cargo build --release
            success "Rust backend built"

            # Build forest-embed helper
            info "Building forest-embed helper..."
            cargo build --release --bin forest-embed
            success "forest-embed built"

            # Build frontend and create Tauri bundle
            info "Building Tauri bundle..."
            cd "$DESKTOP_DIR"
            bun run release
            success "Desktop app built successfully"
            ;;
        all)
            cmd_build cli
            cmd_build desktop
            success "All projects built successfully"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, desktop, all"
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
        desktop)
            info "Running desktop Rust tests..."
            cd "$DESKTOP_DIR/src-tauri"
            cargo test
            success "Desktop tests passed"
            ;;
        all)
            cmd_test cli
            cmd_test desktop
            success "All tests passed"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, desktop, all"
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
        desktop)
            info "Type-checking desktop frontend..."
            cd "$DESKTOP_DIR"
            bunx tsc --noEmit
            success "Desktop frontend type-check passed"

            info "Checking desktop Rust code..."
            cd "$DESKTOP_DIR/src-tauri"
            cargo check
            success "Desktop Rust check passed"
            ;;
        all)
            cmd_lint cli
            cmd_lint desktop
            success "All type-checks passed"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, desktop, all"
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
        desktop)
            info "Cleaning desktop build artifacts..."
            cd "$DESKTOP_DIR"
            rm -rf dist/
            rm -rf src-tauri/target/
            success "Desktop cleaned"
            ;;
        all)
            cmd_clean cli
            cmd_clean desktop
            success "All build artifacts cleaned"
            ;;
        *)
            error "Unknown target: $1"
            echo "Valid targets: cli, desktop, all"
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
