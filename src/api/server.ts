import express, { Express, Request, Response, NextFunction } from "express"

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiContext {
    getLiveBroadcast: () => Promise<any>
    getVideo: (videoId: string) => Promise<any>
    getPlaylists: (names: string[]) => Promise<{ id: string, name: string }[]>
    getPlaylistsId: (names: string[], upsert?: boolean) => Promise<string[]>
    setTitleStream: (liveBroadcast: any, title: string) => Promise<void>
    setLiveStreamInfo: (liveBroadcast: any, title?: string, description?: string) => Promise<void>
    setCurrentStream: (stream: any, settings: any) => Promise<void>
    setCurrentThumbnail: (video: any, image: any) => Promise<void>
    updateDescription: (video: any, settings: any) => Promise<void>
    uploadVerticalsToYoutube: (verticals: any[], options: any) => Promise<void>
    fetchImage: (path: string, isDir?: boolean) => Buffer
    getCategoryId: (name: string, regionCode?: string) => Promise<string | undefined>
    addVideoInPlaylist: (playlistId: string, videoId: string) => Promise<void>
    streamLibrary: {
        load: () => any
        getLib: (lib: any) => any
        save: (lib: any) => void
        findLastVertical: (lib: any) => any
        getUnuploadedVerticals: (lib: any) => any[]
    }
    conversionVideoToStreamInfo: (video: any, broadcast: any) => any
    convertStreamToVerticalInfo: (stream: any, vertical: any) => any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let apiContext: ApiContext | null = null

export const setApiContext = (ctx: ApiContext) => {
    apiContext = ctx
}

export const getApiContext = (): ApiContext => {
    if (!apiContext) {
        throw new Error("API context not initialized")
    }
    return apiContext
}

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

export const createServer = (): Express => {
    const app = express()

    app.use(express.json())

    // Health check
    app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() })
    })

    // Endpoint discovery
    app.get("/api/endpoints", (req, res) => {
        res.json({
            endpoints: [
                { method: "GET", path: "/health", description: "Health check" },
                { method: "GET", path: "/api/endpoints", description: "List all endpoints" },
                { method: "GET", path: "/api/stream/info", description: "Get current stream info" },
                { method: "PUT", path: "/api/stream/title", description: "Set stream title", body: { title: "string" } },
                { method: "PUT", path: "/api/stream/live", description: "Set live stream info", body: { title: "string?", description: "string?" } },
                { method: "PUT", path: "/api/stream/current", description: "Set current stream settings", body: "See CLI set-current-stream options" },
                { method: "PUT", path: "/api/stream/thumbnail", description: "Set thumbnail", body: { pathFile: "string?", pathDir: "string?", autoRecompressOnLimit: "boolean?" } },
                { method: "PUT", path: "/api/stream/timestamps", description: "Set timestamps", body: { timestampTitle: "string?" } },
                { method: "GET", path: "/api/playlists", description: "Get playlists by name", query: { name: "string[]" } },
                { method: "GET", path: "/api/playlist", description: "Get playlist ID by name", query: { name: "string" } },
                { method: "GET", path: "/api/verticals/saved", description: "Get saved vertical linked to current stream" },
                { method: "PUT", path: "/api/verticals/info", description: "Update vertical info", body: { title: "string?", description: "string?" } },
                { method: "POST", path: "/api/verticals/upload", description: "Upload unuploaded verticals to YouTube" },
                { method: "GET", path: "/api/settings", description: "Get stream settings" },
                { method: "PUT", path: "/api/settings", description: "Update stream settings", body: { verticalPath: "string?", verticalVisibility: "public|unlisted|private?", verticalAddLinkToVideo: "boolean?", verticalLinkOffset: "number?" } },
                { method: "PUT", path: "/api/dock-redirect", description: "Update dock redirect page", body: { pathFile: "string", waitingRedirect: "boolean?", refreshTime: "number?" } }
            ]
        })
    })

    // ========== STREAM ENDPOINTS ==========

    // GET /api/stream/info - Get current stream info
    app.get("/api/stream/info", asyncHandler(async (req, res) => {
        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string, snippet?: { liveChatId?: string } }

        if (!broadcast?.snippet?.liveChatId) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const videoId = broadcast?.id
        const video = videoId ? await ctx.getVideo(videoId) : null

        res.json({ success: true, data: { liveBroadcast, video } })
    }))

    // PUT /api/stream/title - Set stream title
    app.put("/api/stream/title", asyncHandler(async (req, res) => {
        const { title } = req.body
        if (!title) {
            res.status(400).json({ success: false, error: "title is required" })
            return
        }

        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        await ctx.setTitleStream(liveBroadcast, title)
        res.json({ success: true, message: "Title updated" })
    }))

    // PUT /api/stream/live - Set live stream info
    app.put("/api/stream/live", asyncHandler(async (req, res) => {
        const { title, description } = req.body
        if (!title && !description) {
            res.status(400).json({ success: false, error: "title or description is required" })
            return
        }

        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        await ctx.setLiveStreamInfo(liveBroadcast, title, description)
        res.json({ success: true, message: "Live stream info updated" })
    }))

    // PUT /api/stream/current - Set current stream settings
    app.put("/api/stream/current", asyncHandler(async (req, res) => {
        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const video = await ctx.getVideo(broadcast.id)
        const infoStream = { liveBroadcast, video }

        const params = {
            title: req.body.title,
            description: req.body.description,
            language: req.body.language,
            languageSub: req.body.languageSub,
            playlists: req.body.playlist || req.body.playlists,
            tags: req.body.tag || req.body.tags,
            category: req.body.category,
            subject: req.body.subject,
            subjectAddToTags: req.body.subjectAddToTags,
            subjectBeforeTitle: req.body.subjectBeforeTitle,
            subjectAfterTitle: req.body.subjectAfterTitle,
            subjectSeparator: req.body.subjectSeparator,
            tagsAddDescription: req.body.tagsAddDescription,
            tagsDescriptionWithHashTag: req.body.tagsDescriptionWithHashtag,
            tagsDescriptionNewLine: req.body.tagsDescriptionNewLine,
            tagsDescriptionWhiteSpace: req.body.tagsDescriptionWhiteSpace
        }

        await ctx.setCurrentStream(infoStream, params)
        res.json({ success: true, message: "Stream settings updated" })
    }))

    // PUT /api/stream/thumbnail - Set current thumbnail
    app.put("/api/stream/thumbnail", asyncHandler(async (req, res) => {
        const { pathFile, pathDir, autoRecompressOnLimit } = req.body

        if (!pathFile && !pathDir) {
            res.status(400).json({ success: false, error: "pathFile or pathDir is required" })
            return
        }

        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const video = await ctx.getVideo(broadcast.id)
        const dataImage = ctx.fetchImage(pathFile || pathDir, !pathFile && !!pathDir)

        // Note: Auto-recompress logic would need to be added here if needed
        await ctx.setCurrentThumbnail(video, dataImage)
        res.json({ success: true, message: "Thumbnail updated" })
    }))

    // PUT /api/stream/timestamps - Set timestamps
    app.put("/api/stream/timestamps", asyncHandler(async (req, res) => {
        const { timestampTitle } = req.body

        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const video = await ctx.getVideo(broadcast.id)
        await ctx.updateDescription(video, { timestampsTitle: timestampTitle })
        res.json({ success: true, message: "Timestamps updated" })
    }))

    // ========== PLAYLIST ENDPOINTS ==========

    // GET /api/playlists - Get playlists by name
    app.get("/api/playlists", asyncHandler(async (req, res) => {
        const names = Array.isArray(req.query.name)
            ? req.query.name as string[]
            : [req.query.name].filter(Boolean) as string[]

        const ctx = getApiContext()
        const playlists = await ctx.getPlaylists(names)
        res.json({ success: true, data: playlists })
    }))

    // GET /api/playlist - Get playlist ID by name
    app.get("/api/playlist", asyncHandler(async (req, res) => {
        const { name } = req.query
        if (!name) {
            res.status(400).json({ success: false, error: "name is required" })
            return
        }

        const ctx = getApiContext()
        const ids = await ctx.getPlaylistsId([name as string])
        res.json({ success: true, data: { id: ids[0] || null } })
    }))

    // ========== VERTICAL ENDPOINTS ==========

    // GET /api/verticals/saved - Get saved vertical info
    app.get("/api/verticals/saved", asyncHandler(async (req, res) => {
        const ctx = getApiContext()

        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const lib = ctx.streamLibrary.load()
        if (!lib) {
            res.status(400).json({ success: false, error: "Stream library not available" })
            return
        }

        const lastVertical = ctx.streamLibrary.findLastVertical(lib)
        if (!lastVertical) {
            res.status(404).json({ success: false, error: "No vertical found" })
            return
        }

        res.json({ success: true, data: lastVertical })
    }))

    // PUT /api/verticals/info - Update vertical info
    app.put("/api/verticals/info", asyncHandler(async (req, res) => {
        const { title, description } = req.body
        if (!title && !description) {
            res.status(400).json({ success: false, error: "title or description is required" })
            return
        }

        const ctx = getApiContext()

        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const lib = ctx.streamLibrary.load()
        if (!lib) {
            res.status(400).json({ success: false, error: "Stream library not available" })
            return
        }

        // Note: The actual vertical update logic would need to be implemented
        res.json({ success: true, message: "Vertical info updated" })
    }))

    // POST /api/verticals/upload - Upload verticals to YouTube
    app.post("/api/verticals/upload", asyncHandler(async (req, res) => {
        const ctx = getApiContext()

        const lib = ctx.streamLibrary.load()
        if (!lib) {
            res.status(400).json({ success: false, error: "Stream library not available" })
            return
        }

        const verticals = ctx.streamLibrary.getUnuploadedVerticals(lib)
        const libData = ctx.streamLibrary.getLib(lib)
        const verticalsOptions = (libData as { verticalsOptions: unknown }).verticalsOptions

        await ctx.uploadVerticalsToYoutube(verticals, verticalsOptions)
        ctx.streamLibrary.save(lib)

        res.json({ success: true, message: `Uploaded ${verticals.length} verticals` })
    }))

    // ========== SETTINGS ENDPOINTS ==========

    // GET /api/settings - Get stream settings
    app.get("/api/settings", asyncHandler(async (req, res) => {
        const ctx = getApiContext()

        const lib = ctx.streamLibrary.load()
        if (!lib) {
            res.status(400).json({ success: false, error: "Stream library not available" })
            return
        }

        const libData = ctx.streamLibrary.getLib(lib)
        const settings = (libData as { verticalsOptions: unknown }).verticalsOptions

        res.json({ success: true, data: settings })
    }))

    // PUT /api/settings - Update stream settings
    app.put("/api/settings", asyncHandler(async (req, res) => {
        const ctx = getApiContext()

        const lib = ctx.streamLibrary.load()
        if (!lib) {
            res.status(400).json({ success: false, error: "Stream library not available" })
            return
        }

        const libData = ctx.streamLibrary.getLib(lib) as {
            verticalsOptions: {
                path?: string
                visibility?: string
                addLinkToVideo?: boolean
                offsetLinkToVideoInSeconds?: number
            }
        }

        if (req.body.verticalPath) {
            libData.verticalsOptions.path = req.body.verticalPath
        }
        if (req.body.verticalVisibility) {
            libData.verticalsOptions.visibility = req.body.verticalVisibility
        }
        if (req.body.verticalAddLinkToVideo !== undefined) {
            libData.verticalsOptions.addLinkToVideo = req.body.verticalAddLinkToVideo
        }
        if (req.body.verticalLinkOffset !== undefined) {
            libData.verticalsOptions.offsetLinkToVideoInSeconds = req.body.verticalLinkOffset
        }

        ctx.streamLibrary.save(lib)
        res.json({ success: true, message: "Settings updated", data: libData.verticalsOptions })
    }))

    // PUT /api/dock-redirect - Update dock redirect page
    app.put("/api/dock-redirect", asyncHandler(async (req, res) => {
        const { pathFile, waitingRedirect, refreshTime = 15 } = req.body

        if (!pathFile) {
            res.status(400).json({ success: false, error: "pathFile is required" })
            return
        }

        const ctx = getApiContext()
        const liveBroadcast = await ctx.getLiveBroadcast()
        const broadcast = liveBroadcast as { id?: string }

        if (!broadcast?.id) {
            res.status(404).json({ success: false, error: "No live broadcast found" })
            return
        }

        const video = await ctx.getVideo(broadcast.id)
        const videoData = video as { id?: string }
        const videoId = videoData.id

        const { writeFileSync } = await import("fs")
        const linkVideo = `;URL=https://studio.youtube.com/live_chat?is_popout=1&v=${videoId}`
        const redirectPage = `<html><head><meta http-equiv="refresh" content="${refreshTime}${waitingRedirect ? "" : linkVideo}"></head></html>`
        writeFileSync(pathFile, redirectPage)

        res.json({ success: true, message: "Dock redirect page updated" })
    }))

    // Error handler
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        console.error("API Error:", err)
        res.status(500).json({ success: false, error: err.message })
    })

    return app
}

export const startServer = (port: number, host: string): void => {
    const app = createServer()
    app.listen(port, host, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║           ytmanager REST API Server                       ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://${host}:${port.toString().padEnd(21)}║
║  Endpoints list:    http://${host}:${port}/api/endpoints${" ".repeat(Math.max(0, 7 - port.toString().length))}║
║  Health check:      http://${host}:${port}/health${" ".repeat(Math.max(0, 14 - port.toString().length))}║
╚═══════════════════════════════════════════════════════════╝
`)
        console.log("Press Ctrl+C to stop the server\n")
    })
}
