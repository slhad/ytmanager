
import { ActionDefinition } from "./types"
import { Context } from "./context"
import { CurrentStreamSettings } from "./service"
import { join } from "path"
import { readFileSync } from "fs"
import imageminPngquant from "imagemin-pngquant"

export const actions: ActionDefinition[] = [
    {
        name: "info",
        summary: "Get current stream info",
        description: "Will return broadcast and video info",
        handler: async (_, ctx: Context) => {
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            let video
            if (liveBroadcast.id) {
                video = await ctx.service.getVideo(liveBroadcast.id)
            }
            return { liveBroadcast, video }
        },
        api: {
            method: "GET",
            path: "/stream/info"
        }
    },
    {
        name: "set-title",
        summary: "Set stream title",
        description: "Set your stream title",
        parameters: [
            {
                name: "title",
                type: "string",
                description: "Title to set",
                argumentName: "TITLE",
                required: true
            }
        ],
        handler: async (params, ctx: Context) => {
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            await ctx.service.setTitleStream(liveBroadcast, params.title)
            return { success: true }
        },
        api: {
            method: "PUT",
            path: "/stream/title"
        }
    },
    {
        name: "set-live-stream",
        summary: "Set live stream info",
        description: "Set your live stream info",
        parameters: [
            {
                name: "title",
                type: "string",
                description: "Title to set",
                argumentName: "TITLE"
            },
            {
                name: "description",
                type: "string",
                description: "Description to set",
                argumentName: "DESCRIPTION"
            }
        ],
        handler: async (params, ctx: Context) => {
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            await ctx.service.setLiveStreamInfo(liveBroadcast, params.title, params.description)
            return { success: true }
        },
        api: {
            method: "PUT",
            path: "/stream/live"
        }
    },
    {
        name: "get-playlists",
        summary: "get playlists",
        description: "Get playlists by name",
        parameters: [
            {
                name: "playlist",
                type: "stringList",
                description: "Playlist name",
                argumentName: "PLAYLIST",
                required: true
            }
        ],
        handler: async (params, ctx: Context) => {
            const playlists = await ctx.service.getPlaylists(params.playlist)
            return playlists
        },
        api: {
            method: "GET",
            path: "/playlists"
        }
    },
    {
        name: "get-playlist",
        summary: "get playlist id",
        description: "Get playlist id by name",
        parameters: [
            {
                name: "playlist",
                type: "string",
                description: "Playlist name",
                argumentName: "PLAYLIST",
                required: true
            }
        ],
        handler: async (params, ctx: Context) => {
            const playlists = await ctx.service.getPlaylists([params.playlist])
            return playlists[0]?.id
        },
        api: {
            method: "GET",
            path: "/playlist"
        }
    },
    {
        name: "vertical-saved",
        summary: "lookup and link saved vertical to current stream",
        description: "Look for a vertical saved in the vertical folder and link it to current stream",
        handler: async (_, ctx: Context) => {
            if (!ctx.library) throw new Error("Library not loaded")
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            if (!liveBroadcast.id) throw new Error("No live broadcast found")

            const lastVertical = ctx.library.findLastVertical()
            if (lastVertical) {
                const videoData = await ctx.service.getVideo(liveBroadcast.id)
                // Need to import conversionVideoToStreamInfo but it's not exported from service yet appropriately
                // We'll fix service exports or import from persistence directly for types
                // Actually persistence exports convertStreamToVerticalInfo
                // Wait, service methods like conversionVideoToStreamInfo were not moved to service class?
                // Ah, I missed adding helper functions to service class. 
                // Let's assume we can import convertStreamToVerticalInfo and conversionVideoToStreamInfo from persistence.

                const { conversionVideoToStreamInfo, convertStreamToVerticalInfo } = await import("./persistence")

                const streamInfo = conversionVideoToStreamInfo(videoData, liveBroadcast)
                ctx.library.addStream(streamInfo)

                const stream = ctx.library.lib.streams[liveBroadcast.id]
                const vertical = convertStreamToVerticalInfo(stream, lastVertical)
                ctx.library.addVerticalToStream(stream.id, vertical)
                ctx.library.save()
                return vertical
            }
            return null
        },
        api: {
            method: "GET",
            path: "/verticals/saved"
        }
    },
    {
        name: "vertical-info",
        summary: "update last saved vertical linked to current stream with info",
        description: "Update info of last vertical linked to current stream with info",
        parameters: [
            {
                name: "title",
                type: "string",
                description: "Title to set",
                argumentName: "TITLE"
            },
            {
                name: "description",
                type: "string",
                description: "Description to set",
                argumentName: "DESCRIPTION"
            }
        ],
        handler: async (params, ctx: Context) => {
            if (!ctx.library) throw new Error("Library not loaded")
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            if (!liveBroadcast.id) throw new Error("No live broadcast found")

            const stream = ctx.library.lib.streams[liveBroadcast.id]
            if (!stream) throw new Error("Stream not found in library")

            const last = Object.keys(stream.verticals).sort()[0]
            if (!last) throw new Error("No vertical found for stream")

            const vertical = stream.verticals[last]
            if (params.title) vertical.title = params.title
            if (params.description) vertical.description = params.description

            ctx.library.save()
            return vertical
        },
        api: {
            method: "PUT",
            path: "/verticals/info"
        }
    },
    {
        name: "verticals-upload",
        summary: "Upload your vertical to YT",
        description: "Use it to upload your vertical to YT",
        handler: async (_, ctx: Context) => {
            if (!ctx.library) throw new Error("Library not loaded")
            const verticals = ctx.library.getUnuploadedVerticals()
            await ctx.service.uploadVerticalsToYoutube(verticals, ctx.library.lib.verticalsOptions)
            ctx.library.save()
            return { uploadedCount: verticals.length }
        },
        api: {
            method: "POST",
            path: "/verticals/upload"
        }
    },
    {
        name: "stream-settings",
        summary: "Change stream settings",
        description: "Use this command to change the settings",
        parameters: [
            {
                name: "vertical-path",
                type: "string",
                description: "Change the lookup path for verticals",
                argumentName: "VERTICAL_PATH"
            },
            {
                name: "vertical-visibility",
                type: "choice",
                description: "Set the visibility of the vertical",
                alternatives: ["public", "unlisted", "private"],
                environmentVariable: "VERTICAL_VISIBILITY"
            },
            {
                name: "vertical-add-link-to-video",
                type: "choice",
                description: "Add a video link to the vertical",
                alternatives: ["true", "false"],
                environmentVariable: "ADD_LINK_TO_VIDEO"
            },
            {
                name: "vertical-link-offset",
                type: "integer",
                description: "Offset of the video link in the vertical",
                argumentName: "VERTICAL_LINK_OFFSET",
                environmentVariable: "VERTICAL_LINK_OFFSET"
            }
        ],
        handler: async (params, ctx: Context) => {
            if (!ctx.library) throw new Error("Library not loaded")

            if (params["vertical-path"]) {
                ctx.library.lib.verticalsOptions.path = params["vertical-path"]
            }
            if (params["vertical-add-link-to-video"]) {
                ctx.library.lib.verticalsOptions.addLinkToVideo = params["vertical-add-link-to-video"] === "true"
            }
            if (params["vertical-link-offset"] !== undefined) {
                ctx.library.lib.verticalsOptions.offsetLinkToVideoInSeconds = params["vertical-link-offset"]
            }
            if (params["vertical-visibility"]) {
                ctx.library.lib.verticalsOptions.visibility = params["vertical-visibility"]
            }
            ctx.library.save()
            return ctx.library.lib.verticalsOptions
        },
        api: {
            method: "PUT",
            path: "/settings"
        }
    },
    {
        name: "set-current-stream",
        summary: "set current stream",
        description: "Set parameters to current stream",
        parameters: [
            { name: "playlist", type: "stringList", description: "Playlist name", argumentName: "PLAYLIST", environmentVariable: "PLAYLIST" },
            { name: "language", type: "string", description: "Language name", argumentName: "LANG", environmentVariable: "LG" },
            { name: "language-sub", type: "string", description: "Language subtitle name", argumentName: "LANGSUB", environmentVariable: "LGSUB" },
            { name: "tag", type: "stringList", description: "Tag", argumentName: "TAG", environmentVariable: "TAG" },
            { name: "category", type: "string", description: "Category name", argumentName: "CATEGORY", environmentVariable: "CATEGORY" },
            { name: "subject", type: "string", description: "Subject to use at different place", argumentName: "SUBJECT", environmentVariable: "SUBJECT" },
            { name: "subject-before-title", type: "boolean", description: "Add subject before title", environmentVariable: "SUBJECT_BEFORE_TITLE" },
            { name: "subject-after-title", type: "boolean", description: "Add subject after title", environmentVariable: "SUBJECT_AFTER_TITLE" },
            { name: "subject-separator", type: "string", description: "Subject separator", argumentName: "SEPARATOR", environmentVariable: "SUBJECT_SEPARATOR" },
            { name: "subject-add-to-tags", type: "boolean", description: "Add subject to tags", environmentVariable: "SUBJECT_ADD_TAGS" },
            { name: "tags-add-description", type: "boolean", description: "Add tags to description", environmentVariable: "TAGS_ADD_DESCRIPTION" },
            { name: "tags-description-with-hashtag", type: "boolean", description: "Add # to tags in description", environmentVariable: "TAGS_DESCRIPTION_WITH_HASHTAG" },
            { name: "tags-description-new-line", type: "boolean", description: "Tags in description on new line", environmentVariable: "TAGS_DESCRIPTION_NEW_LINE" },
            { name: "tags-description-white-space", type: "string", description: "Tags space replacement in description", argumentName: "WHITE_SPACE", environmentVariable: "TAGS_DESCRIPTION_WHITE_SPACE" },
            { name: "title", type: "string", description: "Title to set", argumentName: "TITLE", environmentVariable: "TITLE" },
            { name: "description", type: "string", description: "Description to set", argumentName: "DESCRIPTION", environmentVariable: "DESCRIPTION" }
        ],
        handler: async (params, ctx: Context) => {
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            if (!liveBroadcast.id) throw new Error("No live broadcast found")
            const video = await ctx.service.getVideo(liveBroadcast.id)

            const css: CurrentStreamSettings = {
                title: params.title,
                description: params.description,
                language: params.language,
                languageSub: params["language-sub"],
                playlists: params.playlist,
                tags: params.tag,
                category: params.category,
                subject: params.subject,
                subjectAddToTags: params["subject-add-to-tags"],
                subjectBeforeTitle: params["subject-before-title"],
                subjectAfterTitle: params["subject-after-title"],
                subjectSeparator: params["subject-separator"],
                tagsAddDescription: params["tags-add-description"],
                tagsDescriptionWithHashTag: params["tags-description-with-hashtag"],
                tagsDescriptionNewLine: params["tags-description-new-line"],
                tagsDescriptionWhiteSpace: params["tags-description-white-space"]
            }

            await ctx.service.setCurrentStream({ liveBroadcast, video }, css)
            return { success: true }
        },
        api: {
            method: "PUT",
            path: "/stream/current"
        }
    },
    {
        name: "set-timestamps",
        summary: "Set timestamps",
        description: "Set timestamps",
        parameters: [
            {
                name: "timestamp-title",
                type: "string",
                description: "Timestamp in description",
                argumentName: "TIMESTAMP_TITLE",
                environmentVariable: "TIMESTAMP_TITLE"
            }
        ],
        handler: async (params, ctx: Context) => {
            if (!ctx.library) throw new Error("Library not loaded")
            const liveBroadcast = await ctx.service.getLiveBroadcast()
            if (!liveBroadcast.id) throw new Error("No live broadcast found")

            const videoId = liveBroadcast.id
            const timestampsData = readFileSync(ctx.library.lib.timestampsPath).toString()
            ctx.library.addTimestampsToStream(videoId, timestampsData)
            ctx.library.save()

            const stream = ctx.library.lib.streams[videoId]
            const css: CurrentStreamSettings = {
                timestamps: stream.timestamps,
                timestampsTitle: params["timestamp-title"]
            }

            const video = await ctx.service.getVideo(videoId)
            await ctx.service.updateDescription(video, css)
            return { success: true }
        },
        api: {
            method: "PUT",
            path: "/stream/timestamps"
        }
    },
    {
        name: "set-current-thumbnail",
        summary: "set current thumbnail",
        description: "Set thumbnail to current stream",
        parameters: [
            { name: "path-file", type: "string", description: "File path of the thumbnail", argumentName: "PATH_FILE", environmentVariable: "PATH_FILE" },
            { name: "path-dir", type: "string", description: "Dir path of the thumbnail", argumentName: "PATH_DIR", environmentVariable: "PATH_DIR" },
            { name: "auto-recompress-on-limit", type: "boolean", description: "Auto recompress image", environmentVariable: "AUTO_RECOMPRESS_ON_LIMIT" }
        ],
        handler: async (params, ctx: Context) => {
            const dir = params["path-dir"]
            const file = params["path-file"]
            const autoRecompress = params["auto-recompress-on-limit"]
            const YOUTUBE_THUMBNAIL_SIZE_LIMIT = 2097152

            if (file || dir) {
                const liveBroadcast = await ctx.service.getLiveBroadcast()
                if (!liveBroadcast.id) throw new Error("No live broadcast found")

                let dataImage = ctx.service.fetchImage(file || dir || "", !file && !!dir)

                if (dataImage.length > YOUTUBE_THUMBNAIL_SIZE_LIMIT) {
                    console.log(`Thumbnail size ${dataImage.length} is bigger than youtube api limit`)
                    if (autoRecompress) {
                        dataImage = await imageminPngquant({ speed: 1 })(dataImage)
                        console.log(`Recompressed thumbnail to ${dataImage.length}`)
                    } else {
                        console.log("Auto recompression disabled")
                    }
                }

                const video = await ctx.service.getVideo(liveBroadcast.id)
                await ctx.service.setCurrentThumbnail(video, dataImage)
                return { success: true }
            }
            return { success: false, message: "No file or dir specified" }
        },
        api: {
            method: "PUT",
            path: "/stream/thumbnail"
        }
    },
    {
        name: "update-dock-redirect",
        summary: "Update html redirect page dock to youtube chat",
        description: "Update html redirect page dock to youtube chat",
        parameters: [
            { name: "path-file", type: "string", description: "File path of the page dock", argumentName: "PATH_FILE", environmentVariable: "PATH_FILE" },
            { name: "waiting-redirect", type: "boolean", description: "Generate a html page redirecting to itself", environmentVariable: "WAITING_REDIRECT" },
            { name: "refresh-time", type: "integer", description: "Refresh page after X seconds", argumentName: "REFRESH_TIME", environmentVariable: "REFRESH_TIME", defaultValue: 15 }
        ],
        handler: async (params, ctx: Context) => {
            const file = params["path-file"]
            if (file) {
                const liveBroadcast = await ctx.service.getLiveBroadcast()
                if (!liveBroadcast.id) throw new Error("No live broadcast found")

                const isWaitingPage = params["waiting-redirect"]
                const refreshTime = params["refresh-time"] || 15
                const videoId = liveBroadcast.id
                const linkVideo = `;URL=https://studio.youtube.com/live_chat?is_popout=1&v=${videoId}`
                const redirectPage = `<html><head><meta http-equiv="refresh" content="${refreshTime}${isWaitingPage ? "" : linkVideo}"></head></html>`

                const fs = await import("fs")
                fs.writeFileSync(file, redirectPage)
                return { success: true }
            }
            return { success: false, message: "No path file specified" }
        },
        api: {
            method: "PUT",
            path: "/dock-redirect"
        }
    },
    {
        name: "serve",
        summary: "Start REST API server",
        description: "Start a local REST API server to access ytmanager features via HTTP endpoints",
        parameters: [
            { name: "port", type: "integer", description: "Port to run the API server on", argumentName: "PORT", defaultValue: 3001 },
            { name: "host", type: "string", description: "Host to bind the API server to", argumentName: "HOST", defaultValue: "localhost" }
        ],
        handler: async (params, ctx: Context) => {
            // This is handled specially in CLI runner usually, but if called via action...
            // The server starter needs to be seperate
            const port = params.port || 3001
            const host = params.host || "localhost"

            // Dynamic import to avoid circular dependency if server imports actions
            const { startServer } = await import("./api/server")
            startServer(port, host, ctx)
            return { success: true, message: "Server started" }
        },
        api: {
            // Not exposed via API
            path: undefined
        }
    }
]
