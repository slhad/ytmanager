Bruno collection for ytmanager

Overview
- This folder contains a Bruno OpenCollection YAML to call the local `ytmanager` API.
- It assumes the `ytmanager` server process is already running and authenticated with valid OAuth tokens.

Files
- `bruno/collection.yaml`: Bruno collection with sample requests (Get Stream Info, Set Stream Title, Set Current Stream, Get Playlists).
- `bruno/collection-schema-mapping.txt`: mapping from Bruno requests to server action names and source references.

Usage
1. Start the ytmanager server (must be authenticated first). See `src/index.ts` for server startup and auth flow.
2. Import `bruno/collection.yaml` into Bruno or use the Bruno CLI.
3. Update `baseUrl` variable in the collection if your server uses a different host/port.

Notes on auth
- The API endpoints exposed here expect the server process to have valid OAuth tokens (stored in `config.json` after running the OAuth flow). The collection does not perform OAuth itself.
- See `src/auth.ts` for the OAuth helper and `src/index.ts` for how the CLI initializes authenticated service objects.

Parameter rules
- GET endpoints pass parameters via the query string; PUT/POST endpoints accept JSON bodies.
- The server accepts hyphenated parameter names (e.g., `path-file`) and also accepts camelCase equivalents (e.g., `pathFile`). See `src/api/server.ts` parameter extraction for details.

Quick verification
- Confirm the server is running and endpoints are available:

```bash
curl http://localhost:3001/api/endpoints
```

- Example curl calls:

```bash
curl http://localhost:3001/api/stream/info

curl -X PUT http://localhost:3001/api/stream/title \
  -H "Content-Type: application/json" \
  -d '{"title":"My Stream Title"}'

curl -X PUT http://localhost:3001/api/stream/current \
  -H "Content-Type: application/json" \
  -d '{"title":"Weekend Stream","description":"Chat and games","playlist":"Gaming,Live","tag":"gameplay,fun"}'

curl "http://localhost:3001/api/playlists?playlist=Gaming,Live"
```

References
- Server endpoints and registration: `src/api/server.ts`
- Action implementations: `src/actions.ts`
- OAuth helper: `src/auth.ts`
