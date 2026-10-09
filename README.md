# ORCA — Browser Demo

This is the **demo** branch: an interactive ORCA preview with English sample data saved in localStorage. It opens directly without login. No API server, database, Redis, credentials, or authorization system is required.

```bash
cd web
npm ci
npm run dev -- --port 3010
```

Or run the static frontend container:

```bash
docker compose -p orca-demo -f compose.yml up -d --build
```

Open http://localhost:3010. To change the container's published port, set WEB_PORT. Use Reset demo in the sidebar to restore the sample workspace.

See [demo setup, iframe embedding, and limitations](docs/demo-localstorage.md). The original authenticated application remains on the production/development branches. Backend files retained in this checkout are not part of the demo deployment.
