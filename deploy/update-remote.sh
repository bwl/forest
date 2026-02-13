#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Update a remote Forest server over SSH.

Usage:
  deploy/update-remote.sh --host <user@host> [options]

Options:
  --host <user@host>       SSH destination (or set FOREST_DEPLOY_HOST)
  --path <remote_path>     Remote repo path (default: /root/developer/forest)
  --branch <name>          Git branch to deploy (default: master)
  --service <name>         systemd service to restart (default: forest)
  --health-url <url>       Health endpoint to check after deploy
                           (default: http://127.0.0.1:3000/api/v1/health)
  --no-install             Skip bun install
  --no-restart             Skip systemd restart
  --dry-run                Print resolved plan and exit
  -h, --help               Show this help

Examples:
  deploy/update-remote.sh --host root@forest.ettio.com
  deploy/update-remote.sh --host ubuntu@my-host --branch master --service forest
  FOREST_DEPLOY_HOST=root@forest.ettio.com deploy/update-remote.sh --dry-run
EOF
}

host="${FOREST_DEPLOY_HOST:-}"
remote_path="/root/developer/forest"
branch="master"
service="forest"
health_url="http://127.0.0.1:3000/api/v1/health"
skip_install=0
skip_restart=0
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      host="${2:-}"
      shift 2
      ;;
    --path)
      remote_path="${2:-}"
      shift 2
      ;;
    --branch)
      branch="${2:-}"
      shift 2
      ;;
    --service)
      service="${2:-}"
      shift 2
      ;;
    --health-url)
      health_url="${2:-}"
      shift 2
      ;;
    --no-install)
      skip_install=1
      shift
      ;;
    --no-restart)
      skip_restart=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$host" ]]; then
  echo "Missing required --host (or FOREST_DEPLOY_HOST)." >&2
  usage
  exit 1
fi

echo "Deploy plan:"
echo "  host:       $host"
echo "  path:       $remote_path"
echo "  branch:     $branch"
echo "  service:    $service"
echo "  health url: $health_url"
echo "  install:    $([[ $skip_install -eq 1 ]] && echo skip || echo run)"
echo "  restart:    $([[ $skip_restart -eq 1 ]] && echo skip || echo run)"

if [[ $dry_run -eq 1 ]]; then
  exit 0
fi

echo
echo "Running remote deploy..."

ssh "$host" "bash -se" <<EOF
set -euo pipefail

REMOTE_PATH=$(printf '%q' "$remote_path")
BRANCH=$(printf '%q' "$branch")
SERVICE=$(printf '%q' "$service")
HEALTH_URL=$(printf '%q' "$health_url")
SKIP_INSTALL=$skip_install
SKIP_RESTART=$skip_restart

echo "-> cd \$REMOTE_PATH"
cd "\$REMOTE_PATH"

echo "-> git fetch origin \$BRANCH"
git fetch origin "\$BRANCH"

echo "-> git checkout \$BRANCH"
git checkout "\$BRANCH"

echo "-> git pull --ff-only origin \$BRANCH"
git pull --ff-only origin "\$BRANCH"

if [[ "\$SKIP_INSTALL" -ne 1 ]]; then
  echo "-> bun install"
  bun install
fi

echo "-> bun run build"
if bun run build; then
  :
else
  echo "-> bun run build failed; falling back to ./node_modules/.bin/tsc"
  ./node_modules/.bin/tsc
fi

if [[ "\$SKIP_RESTART" -ne 1 ]]; then
  echo "-> sudo systemctl restart \$SERVICE"
  sudo -n systemctl restart "\$SERVICE"
fi

echo "-> curl -fsS \$HEALTH_URL"
curl -fsS "\$HEALTH_URL"

echo
echo "Remote deploy complete."
EOF

echo
echo "Done."
