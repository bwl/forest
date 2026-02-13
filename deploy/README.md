# Forest Server Deployment

Deploy Forest as a remote server on a Linux host behind Caddy reverse proxy.

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Caddy installed (see https://caddyserver.com/docs/install)
- DNS A record for `forest.ettio.com` pointing to the host IP

## Setup

```bash
# 1. Clone and build
cd ~/developer
git clone <repo-url> forest
cd forest
bun install && bun run build

# 2. Create data directory
sudo mkdir -p /var/lib/forest

# 3. Install systemd service
sudo cp deploy/forest.service /etc/systemd/system/forest.service

# 4. Configure secrets
sudo systemctl edit forest
# Add:
#   [Service]
#   Environment=FOREST_API_KEY=<generate-a-strong-key>
#   Environment=FOREST_OR_KEY=<your-openrouter-key>

# 5. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable forest
sudo systemctl start forest

# 6. Verify
curl http://localhost:3000/api/v1/health

# 7. Configure Caddy
# Add the contents of deploy/Caddyfile to /etc/caddy/Caddyfile
# or import it:  import /root/developer/forest/deploy/Caddyfile
sudo systemctl reload caddy

# 8. Verify external access
curl https://forest.ettio.com/api/v1/health
```

## Client Configuration

On your local machine:

```bash
forest config serverUrl https://forest.ettio.com
forest config apiKey <your-api-key>
forest admin health  # verify connectivity
```

## Logs

```bash
sudo journalctl -u forest -f
```

## Updates

```bash
cd ~/developer/forest
git pull
bun install && bun run build
sudo systemctl restart forest
```

### Optional: one-command remote update script

From your local machine, run:

```bash
deploy/update-remote.sh --host root@forest.ettio.com
```

This script will:

1. SSH to the host
2. `git fetch` + `git pull --ff-only` on `master`
3. Run `bun install` and `bun run build`
4. Restart `forest` via systemd
5. Check `http://127.0.0.1:3000/api/v1/health`

Useful flags:

```bash
deploy/update-remote.sh --host root@forest.ettio.com --dry-run
deploy/update-remote.sh --host root@forest.ettio.com --branch master --service forest
deploy/update-remote.sh --host root@forest.ettio.com --no-install --no-restart
```
