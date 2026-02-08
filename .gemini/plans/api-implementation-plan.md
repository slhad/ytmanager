# API Implementation Plan for ytmanager

## Overview

Add a `serve` command to the CLI that starts a local Express REST API server, exposing all existing CLI functionality via HTTP endpoints.

## Architecture

```
src/
├── index.ts              # CLI entry (add serve action handling)
├── cmd.ts                # CLI definitions (add serve action)
├── persistence.ts        # Data layer (unchanged)
├── api/                  # 🆕 New API module
│   ├── server.ts         # Express app configuration
│   ├── routes.ts         # All route definitions
│   └── handlers/         # Request handlers (grouped by domain)
│       ├── stream.ts     # Stream info/settings endpoints
│       ├── playlist.ts   # Playlist endpoints
│       ├── vertical.ts   # Vertical/shorts endpoints
│       └── settings.ts   # Application settings endpoints
└── core/                 # 🆕 Extracted business logic
    └── youtube.ts        # Refactored YouTube operations
```

---

## Phase 1: Extract Business Logic

**Goal**: Decouple YouTube API operations from CLI action handlers so they can be reused by both CLI and API.

### Step 1.1: Create `src/core/youtube.ts`

Extract these functions from `index.ts` into a reusable module:

| Function | Current Location | Purpose |
|----------|-----------------|---------|
| `getLiveBroadcast()` | index.ts:290 | Get current live stream |
| `getVideo()` | index.ts:301 | Get video by ID |
| `setTitleStream()` | index.ts:118 | Update stream title |
| `setCurrentStream()` | index.ts:472 | Apply multiple stream settings |
| `setCurrentThumbnail()` | index.ts:508 | Upload thumbnail |
| `updateVideo()` | (inline) | Update video metadata |
| `getPlaylists()` | index.ts:318 | Get playlists by name |
| `getPlaylistsId()` | index.ts:331 | Get playlist IDs |
| `addVideoInPlaylist()` | index.ts:411 | Add video to playlist |
| `uploadVerticalsToYoutube()` | index.ts:145 | Upload shorts |

### Step 1.2: Create type definitions

Create shared types for API request/response in `src/core/types.ts`:

```typescript
// Request types (matching CLI parameters)
export interface SetCurrentStreamRequest {
  title?: string
  description?: string
  playlist?: string[]
  language?: string
  languageSub?: string
  tag?: string[]
  category?: string
  subject?: string
  subjectBeforeTitle?: boolean
  subjectAfterTitle?: boolean
  subjectSeparator?: string
  subjectAddToTags?: boolean
  tagsAddDescription?: boolean
  tagsDescriptionWithHashtag?: boolean
  tagsDescriptionNewLine?: boolean
  tagsDescriptionWhiteSpace?: string
}

export interface SetThumbnailRequest {
  pathFile?: string
  pathDir?: string
  autoRecompressOnLimit?: boolean
}

export interface StreamSettingsRequest {
  verticalPath?: string
  verticalVisibility?: "public" | "unlisted" | "private"
  verticalAddLinkToVideo?: boolean
  verticalLinkOffset?: number
}

// Response types
export interface StreamInfoResponse {
  liveBroadcast: object
  video: object
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

---

## Phase 2: Add CLI `serve` Command

### Step 2.1: Update `src/cmd.ts`

Add new serve action with port configuration:

```typescript
const serveAction = new DynamicCommandLineAction({
    actionName: "serve",
    summary: "Start REST API server",
    documentation: "Start a local REST API server to access ytmanager features via HTTP"
})

serveAction.defineIntegerParameter({
    parameterLongName: "--port",
    parameterShortName: "-P",
    argumentName: "PORT",
    description: "Port to run the server on",
    defaultValue: 3001
})

clp.addAction(serveAction)

// Export in actions object
export const commandLineParser = {
    // ...existing
    actions: {
        // ...existing actions
        serveAction
    }
}
```

---

## Phase 3: Create API Layer

### Step 3.1: Create `src/api/server.ts`

```typescript
import express, { Express } from "express"
import { setupRoutes } from "./routes"

export const createServer = (port: number): Express => {
    const app = express()
    
    app.use(express.json())
    
    // Health check
    app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() })
    })
    
    // API routes
    setupRoutes(app)
    
    // Error handler
    app.use((err, req, res, next) => {
        console.error(err)
        res.status(500).json({ success: false, error: err.message })
    })
    
    return app
}

export const startServer = (port: number): void => {
    const app = createServer(port)
    app.listen(port, () => {
        console.log(`ytmanager API server running at http://localhost:${port}`)
        console.log(`Available endpoints: GET http://localhost:${port}/api/endpoints`)
    })
}
```

### Step 3.2: Create `src/api/routes.ts`

```typescript
import { Express } from "express"
import * as streamHandlers from "./handlers/stream"
import * as playlistHandlers from "./handlers/playlist"
import * as verticalHandlers from "./handlers/vertical"
import * as settingsHandlers from "./handlers/settings"

export const setupRoutes = (app: Express): void => {
    // Stream endpoints
    app.get("/api/stream/info", streamHandlers.getInfo)
    app.put("/api/stream/title", streamHandlers.setTitle)
    app.put("/api/stream/live", streamHandlers.setLiveStream)
    app.put("/api/stream/current", streamHandlers.setCurrentStream)
    app.put("/api/stream/thumbnail", streamHandlers.setThumbnail)
    app.put("/api/stream/timestamps", streamHandlers.setTimestamps)
    
    // Playlist endpoints
    app.get("/api/playlists", playlistHandlers.getPlaylists)
    app.get("/api/playlist", playlistHandlers.getPlaylistId)
    
    // Vertical endpoints
    app.get("/api/verticals/saved", verticalHandlers.getSaved)
    app.put("/api/verticals/info", verticalHandlers.updateInfo)
    app.post("/api/verticals/upload", verticalHandlers.upload)
    app.post("/api/verticals/reconstruct", verticalHandlers.reconstructFromVerticals)
    
    // Settings endpoints
    app.get("/api/settings", settingsHandlers.getSettings)
    app.put("/api/settings", settingsHandlers.updateSettings)
    
    // Dock redirect
    app.put("/api/dock-redirect", streamHandlers.updateDockRedirect)
    
    // Endpoint discovery
    app.get("/api/endpoints", (req, res) => {
        res.json({
            endpoints: [
                { method: "GET",  path: "/api/stream/info",       description: "Get current stream info" },
                { method: "PUT",  path: "/api/stream/title",      description: "Set stream title" },
                { method: "PUT",  path: "/api/stream/live",       description: "Set live stream info" },
                { method: "PUT",  path: "/api/stream/current",    description: "Set current stream settings" },
                { method: "PUT",  path: "/api/stream/thumbnail",  description: "Set current thumbnail" },
                { method: "PUT",  path: "/api/stream/timestamps", description: "Set timestamps" },
                { method: "GET",  path: "/api/playlists",         description: "Get playlists by name" },
                { method: "GET",  path: "/api/playlist",          description: "Get playlist ID by name" },
                { method: "GET",  path: "/api/verticals/saved",   description: "Get saved vertical info" },
                { method: "PUT",  path: "/api/verticals/info",    description: "Update vertical info" },
                { method: "POST", path: "/api/verticals/upload",  description: "Upload verticals to YouTube" },
                { method: "GET",  path: "/api/settings",          description: "Get stream settings" },
                { method: "PUT",  path: "/api/settings",          description: "Update stream settings" },
                { method: "PUT",  path: "/api/dock-redirect",     description: "Update dock redirect page" }
            ]
        })
    })
}
```

### Step 3.3: Create Handler Files

#### `src/api/handlers/stream.ts`

```typescript
import { Request, Response } from "express"
import { getLiveBroadcast, getVideo, setTitleStream, setCurrentStream, setCurrentThumbnail } from "../../core/youtube"

export const getInfo = async (req: Request, res: Response) => {
    try {
        const liveBroadcast = await getLiveBroadcast()
        if (!liveBroadcast?.snippet?.liveChatId) {
            return res.status(404).json({ success: false, error: "No live broadcast found" })
        }
        const videoId = liveBroadcast?.id
        const video = videoId ? await getVideo(videoId) : null
        res.json({ success: true, data: { liveBroadcast, video } })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}

export const setTitle = async (req: Request, res: Response) => {
    try {
        const { title } = req.body
        if (!title) {
            return res.status(400).json({ success: false, error: "title is required" })
        }
        const liveBroadcast = await getLiveBroadcast()
        if (!liveBroadcast) {
            return res.status(404).json({ success: false, error: "No live broadcast found" })
        }
        await setTitleStream(liveBroadcast, title)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}

// ... additional handlers for setLiveStream, setCurrentStream, setThumbnail, setTimestamps, updateDockRedirect
```

#### `src/api/handlers/playlist.ts`

```typescript
import { Request, Response } from "express"
import { getPlaylists, getPlaylistsId } from "../../core/youtube"

export const getPlaylists = async (req: Request, res: Response) => {
    try {
        const names = Array.isArray(req.query.name) ? req.query.name : [req.query.name].filter(Boolean)
        const playlists = await getPlaylists(names as string[])
        res.json({ success: true, data: playlists })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}

export const getPlaylistId = async (req: Request, res: Response) => {
    try {
        const { name } = req.query
        if (!name) {
            return res.status(400).json({ success: false, error: "name is required" })
        }
        const ids = await getPlaylistsId([name as string])
        res.json({ success: true, data: { id: ids[0] } })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}
```

#### `src/api/handlers/vertical.ts` and `src/api/handlers/settings.ts`

Similar pattern - wrap existing business logic with HTTP request/response handling.

---

## Phase 4: Update CLI Entry Point

### Step 4.1: Update `src/index.ts`

Add serve action handling in the main switch statement:

```typescript
import { startServer } from "./api/server"

// In the act() function, add case for serve:
case "serve": {
    const port = actions.serveAction.parametersByLongName.get("--port")?.value as number
    startServer(port ?? 3001)
    break
}
```

---

## API Endpoint Mapping (CLI → REST)

| CLI Command | HTTP Method | Endpoint | Request Body/Query |
|------------|-------------|----------|-------------------|
| `info` | GET | `/api/stream/info` | - |
| `set-title --title X` | PUT | `/api/stream/title` | `{ "title": "X" }` |
| `set-live-stream --title X --description Y` | PUT | `/api/stream/live` | `{ "title": "X", "description": "Y" }` |
| `set-current-stream [options]` | PUT | `/api/stream/current` | JSON with all options |
| `set-current-thumbnail --path-file X` | PUT | `/api/stream/thumbnail` | `{ "pathFile": "X" }` |
| `set-timestamps --timestamp-title X` | PUT | `/api/stream/timestamps` | `{ "timestampTitle": "X" }` |
| `get-playlists --playlist X` | GET | `/api/playlists?name=X` | - |
| `get-playlist --playlist X` | GET | `/api/playlist?name=X` | - |
| `vertical-saved` | GET | `/api/verticals/saved` | - |
| `vertical-info --title X --description Y` | PUT | `/api/verticals/info` | `{ "title": "X", "description": "Y" }` |
| `verticals-upload` | POST | `/api/verticals/upload` | - |
| `reconstruct-streams-from-verticals` | POST | `/api/verticals/reconstruct` | - |
| `stream-settings [options]` | GET/PUT | `/api/settings` | JSON with options |
| `update-dock-redirect [options]` | PUT | `/api/dock-redirect` | JSON with options |

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/cmd.ts` | Modify | Add `serveAction` with `--port` parameter |
| `src/index.ts` | Modify | Add serve case, import server |
| `src/core/youtube.ts` | Create | Extract & export YouTube API functions |
| `src/core/types.ts` | Create | Shared TypeScript types |
| `src/api/server.ts` | Create | Express app setup |
| `src/api/routes.ts` | Create | Route definitions |
| `src/api/handlers/stream.ts` | Create | Stream endpoint handlers |
| `src/api/handlers/playlist.ts` | Create | Playlist endpoint handlers |
| `src/api/handlers/vertical.ts` | Create | Vertical endpoint handlers |
| `src/api/handlers/settings.ts` | Create | Settings endpoint handlers |

---

## Usage Example

```bash
# Start the API server
ytmanager serve --port 3001

# Or with npm
npm start -- serve --port 3001
```

Then call the API:

```bash
# Get stream info
curl http://localhost:3001/api/stream/info

# Set stream title
curl -X PUT http://localhost:3001/api/stream/title \
  -H "Content-Type: application/json" \
  -d '{"title": "My New Title"}'

# Get playlists
curl "http://localhost:3001/api/playlists?name=Gaming"

# Set current stream with multiple options
curl -X PUT http://localhost:3001/api/stream/current \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Stream Title",
    "playlist": ["Gaming", "Live"],
    "tag": ["gaming", "live"],
    "category": "Gaming"
  }'
```

---

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1: Extract business logic | ~2-3 hours | Refactor index.ts, create core module |
| Phase 2: Add serve command | ~30 min | Update cmd.ts and index.ts |
| Phase 3: Create API layer | ~2-3 hours | Server, routes, handlers |
| Phase 4: Testing | ~1-2 hours | Manual testing, fix edge cases |
| **Total** | **~6-8 hours** | |

---

## Next Steps

Ready to start implementation? I recommend this order:

1. ✅ Add `serveAction` to `cmd.ts` (simple, quick win)
2. ✅ Create basic `src/api/server.ts` with health endpoint
3. ✅ Add the serve case to `index.ts` and verify it works
4. 🔄 Incrementally add endpoints, extracting logic as needed
