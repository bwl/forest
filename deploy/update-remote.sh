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
  --health-retries <n>     Health-check attempts (default: 8)
  --health-initial-delay <seconds>
                           Initial retry delay for health check (default: 1)
  --health-max-delay <seconds>
                           Max retry delay for health check (default: 8)
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
health_retries=8
health_initial_delay=1
health_max_delay=8
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
    --health-retries)
      health_retries="${2:-}"
      shift 2
      ;;
    --health-initial-delay)
      health_initial_delay="${2:-}"
      shift 2
      ;;
    --health-max-delay)
      health_max_delay="${2:-}"
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

for numeric_value in "$health_retries" "$health_initial_delay" "$health_max_delay"; do
  if ! [[ "$numeric_value" =~ ^[0-9]+$ ]]; then
    echo "Health retry options must be non-negative integers." >&2
    exit 1
  fi
done

if [[ "$health_retries" -lt 1 ]]; then
  echo "--health-retries must be >= 1" >&2
  exit 1
fi

if [[ "$health_initial_delay" -lt 1 ]]; then
  echo "--health-initial-delay must be >= 1" >&2
  exit 1
fi

if [[ "$health_max_delay" -lt 1 ]]; then
  echo "--health-max-delay must be >= 1" >&2
  exit 1
fi

echo "Deploy plan:"
echo "  host:       $host"
echo "  path:       $remote_path"
echo "  branch:     $branch"
echo "  service:    $service"
echo "  health url: $health_url"
echo "  retries:    $health_retries (initial ${health_initial_delay}s, max ${health_max_delay}s)"
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
HEALTH_RETRIES=$health_retries
HEALTH_INITIAL_DELAY=$health_initial_delay
HEALTH_MAX_DELAY=$health_max_delay
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

echo "-> health check \$HEALTH_URL (retries: \$HEALTH_RETRIES)"
attempt=1
delay="\$HEALTH_INITIAL_DELAY"
while true; do
  if curl -fsS "\$HEALTH_URL"; then
    break
  fi

  if [[ "\$attempt" -ge "\$HEALTH_RETRIES" ]]; then
    echo "Health check failed after \$attempt attempt(s)." >&2
    exit 1
  fi

  echo "Health check failed (attempt \$attempt/\$HEALTH_RETRIES). Retrying in \${delay}s..."
  sleep "\$delay"
  attempt=\$((attempt + 1))

  if [[ "\$delay" -lt "\$HEALTH_MAX_DELAY" ]]; then
    delay=\$((delay * 2))
    if [[ "\$delay" -gt "\$HEALTH_MAX_DELAY" ]]; then
      delay="\$HEALTH_MAX_DELAY"
    fi
  fi
done

echo
echo "Remote deploy complete."
EOF

echo
echo "Done."
