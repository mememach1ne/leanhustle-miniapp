#!/usr/bin/env bash
# Universal deploy script. Run on the VPS in /opt/app:
#   bash scripts/deploy.sh
#
# Optional flags:
#   --skip-install   skip pnpm install
#   --skip-web       skip web build
#   --skip-shared    skip shared build
#   --api-only       restart only API
#   --web-only       restart only web

set -e

SKIP_INSTALL=false
SKIP_WEB=false
SKIP_SHARED=false
RESTART_TARGET="all"

for arg in "$@"; do
  case $arg in
    --skip-install) SKIP_INSTALL=true ;;
    --skip-web)     SKIP_WEB=true ;;
    --skip-shared)  SKIP_SHARED=true ;;
    --api-only)     RESTART_TARGET="api" ;;
    --web-only)     RESTART_TARGET="web" ;;
  esac
done

echo "==> git pull"
git pull

if [ "$SKIP_INSTALL" = false ]; then
  echo "==> pnpm install"
  pnpm install --frozen-lockfile
fi

if [ "$SKIP_SHARED" = false ]; then
  echo "==> build shared"
  pnpm --filter @lean-poizon/shared build
  # patch ESM imports (add .js extensions)
  node -e "
    const fs = require('fs');
    const path = require('path');
    const dir = 'packages/shared/dist';
    function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.js')) {
          let c = fs.readFileSync(p, 'utf8');
          c = c.replace(/from '(\.\.?\/[^']+)'/g, (m, imp) => {
            if (imp.endsWith('.js')) return m;
            return \"from '\" + imp + \".js'\";
          });
          fs.writeFileSync(p, c);
        }
      }
    }
    walk(dir);
  "
fi

if [ "$SKIP_WEB" = false ] && [ "$RESTART_TARGET" != "api" ]; then
  echo "==> build web"
  pnpm --filter @lean-poizon/web build
fi

echo "==> pm2 restart $RESTART_TARGET"
pm2 restart $RESTART_TARGET

echo "==> pm2 status"
pm2 status

echo "✓ Deploy complete"
