import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import request from "supertest"
import { createServer, setApiContext, ApiContext } from "../src/api/server"
import type { Express } from "express"

// Create a mock API context for testing
/* eslint-disable @typescript-eslint/no-explicit-any */
const createMockApiContext = (overrides: Partial<ApiContext> = {}): ApiContext => {
    const baseContext: ApiContext = {
        getLiveBroadcast: jest.fn<() => Promise<any>>().mockResolvedValue({
            id: "broadcast-123",
            snippet: {
                title: "Test Stream",
                liveChatId: "chat-123",
                scheduledStartTime: "2026-02-08T10:00:00Z"
            },
            status: {
                privacyStatus: "public"
            }
        }),
        getVideo: jest.fn<(videoId: string) => Promise<any>>().mockResolvedValue({
            id: "video-123",
            snippet: {
                title: "Test Video",
                description: "Test Description",
                tags: ["tag1", "tag2"],
                categoryId: "20"
            }
        }),
        getPlaylists: jest.fn<(names: string[]) => Promise<{ id: string, name: string }[]>>().mockResolvedValue([
            { id: "playlist-1", name: "Gaming" },
            { id: "playlist-2", name: "Live" }
        ]),
        getPlaylistsId: jest.fn<(names: string[], upsert?: boolean) => Promise<string[]>>().mockResolvedValue(["playlist-1", "playlist-2"]),
        setTitleStream: jest.fn<(liveBroadcast: any, title: string) => Promise<void>>().mockResolvedValue(undefined),
        setLiveStreamInfo: jest.fn<(liveBroadcast: any, title?: string, description?: string) => Promise<void>>().mockResolvedValue(undefined),
        setCurrentStream: jest.fn<(stream: any, settings: any) => Promise<void>>().mockResolvedValue(undefined),
        setCurrentThumbnail: jest.fn<(video: any, image: any) => Promise<void>>().mockResolvedValue(undefined),
        updateDescription: jest.fn<(video: any, settings: any) => Promise<void>>().mockResolvedValue(undefined),
        uploadVerticalsToYoutube: jest.fn<(verticals: any[], options: any) => Promise<void>>().mockResolvedValue(undefined),
        fetchImage: jest.fn<(path: string, isDir?: boolean) => Buffer>().mockReturnValue(Buffer.from("fake-image-data")),
        getCategoryId: jest.fn<(name: string, regionCode?: string) => Promise<string | undefined>>().mockResolvedValue("20"),
        addVideoInPlaylist: jest.fn<(playlistId: string, videoId: string) => Promise<void>>().mockResolvedValue(undefined),
        streamLibrary: {
            load: jest.fn<() => any>().mockReturnValue({ lib: { verticalsOptions: { path: "/test", visibility: "public" } } }),
            getLib: jest.fn<(lib: any) => any>().mockReturnValue({ verticalsOptions: { path: "/test", visibility: "public" } }),
            save: jest.fn<(lib: any) => void>(),
            findLastVertical: jest.fn<(lib: any) => any>().mockReturnValue({ name: "vertical-1.mp4", title: "Test Vertical" }),
            getUnuploadedVerticals: jest.fn<(lib: any) => any[]>().mockReturnValue([{ name: "v1.mp4", uploaded: false }])
        },
        conversionVideoToStreamInfo: jest.fn<(video: any, broadcast: any) => any>().mockReturnValue({}),
        convertStreamToVerticalInfo: jest.fn<(stream: any, vertical: any) => any>().mockReturnValue({})
    }

    return { ...baseContext, ...overrides }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("API Server", () => {
    let app: Express
    let mockContext: ApiContext

    beforeEach(() => {
        mockContext = createMockApiContext()
        setApiContext(mockContext)
        app = createServer()
    })

    describe("Health Check", () => {
        it("GET /health should return ok status", async () => {
            const response = await request(app).get("/health")

            expect(response.status).toBe(200)
            expect(response.body.status).toBe("ok")
            expect(response.body.timestamp).toBeDefined()
        })
    })

    describe("Endpoint Discovery", () => {
        it("GET /api/endpoints should list all available endpoints", async () => {
            const response = await request(app).get("/api/endpoints")

            expect(response.status).toBe(200)
            expect(response.body.endpoints).toBeInstanceOf(Array)
            expect(response.body.endpoints.length).toBeGreaterThan(10)

            // Check for some essential endpoints
            const paths = response.body.endpoints.map((e: { path: string }) => e.path)
            expect(paths).toContain("/health")
            expect(paths).toContain("/api/stream/info")
            expect(paths).toContain("/api/playlists")
        })
    })

    describe("Stream Endpoints", () => {
        describe("GET /api/stream/info", () => {
            it("should return stream and video info", async () => {
                const response = await request(app).get("/api/stream/info")

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.data.liveBroadcast).toBeDefined()
                expect(response.body.data.video).toBeDefined()
                expect(mockContext.getLiveBroadcast).toHaveBeenCalled()
                expect(mockContext.getVideo).toHaveBeenCalledWith("broadcast-123")
            })

            it("should return 404 when no live broadcast found", async () => {
                mockContext = createMockApiContext({
                    getLiveBroadcast: jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: null, snippet: {} })
                })
                setApiContext(mockContext)
                app = createServer()

                const response = await request(app).get("/api/stream/info")

                expect(response.status).toBe(404)
                expect(response.body.success).toBe(false)
                expect(response.body.error).toContain("No live broadcast")
            })
        })

        describe("PUT /api/stream/title", () => {
            it("should set stream title successfully", async () => {
                const response = await request(app)
                    .put("/api/stream/title")
                    .send({ title: "New Stream Title" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(mockContext.setTitleStream).toHaveBeenCalled()
            })

            it("should return 400 when title is missing", async () => {
                const response = await request(app)
                    .put("/api/stream/title")
                    .send({})

                expect(response.status).toBe(400)
                expect(response.body.success).toBe(false)
                expect(response.body.error).toContain("title is required")
            })

            it("should return 404 when no live broadcast found", async () => {
                mockContext = createMockApiContext({
                    getLiveBroadcast: jest.fn<() => Promise<unknown>>().mockResolvedValue({})
                })
                setApiContext(mockContext)
                app = createServer()

                const response = await request(app)
                    .put("/api/stream/title")
                    .send({ title: "Test" })

                expect(response.status).toBe(404)
            })
        })

        describe("PUT /api/stream/live", () => {
            it("should update live stream info", async () => {
                const response = await request(app)
                    .put("/api/stream/live")
                    .send({ title: "New Title", description: "New Description" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(mockContext.setLiveStreamInfo).toHaveBeenCalled()
            })

            it("should accept only title", async () => {
                const response = await request(app)
                    .put("/api/stream/live")
                    .send({ title: "New Title" })

                expect(response.status).toBe(200)
            })

            it("should accept only description", async () => {
                const response = await request(app)
                    .put("/api/stream/live")
                    .send({ description: "New Description" })

                expect(response.status).toBe(200)
            })

            it("should return 400 when neither title nor description provided", async () => {
                const response = await request(app)
                    .put("/api/stream/live")
                    .send({})

                expect(response.status).toBe(400)
                expect(response.body.error).toContain("title or description is required")
            })
        })

        describe("PUT /api/stream/current", () => {
            it("should update current stream settings", async () => {
                const response = await request(app)
                    .put("/api/stream/current")
                    .send({
                        title: "Stream Title",
                        description: "Stream Description",
                        tags: ["gaming", "live"],
                        playlist: ["Gaming"]
                    })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(mockContext.setCurrentStream).toHaveBeenCalled()
            })

            it("should handle playlists as array with plural key", async () => {
                const response = await request(app)
                    .put("/api/stream/current")
                    .send({
                        title: "Test",
                        playlists: ["Gaming", "Live"]
                    })

                expect(response.status).toBe(200)
            })
        })

        describe("PUT /api/stream/thumbnail", () => {
            it("should set thumbnail from file path", async () => {
                const response = await request(app)
                    .put("/api/stream/thumbnail")
                    .send({ pathFile: "/path/to/image.png" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(mockContext.fetchImage).toHaveBeenCalledWith("/path/to/image.png", false)
                expect(mockContext.setCurrentThumbnail).toHaveBeenCalled()
            })

            it("should set thumbnail from directory path", async () => {
                const response = await request(app)
                    .put("/api/stream/thumbnail")
                    .send({ pathDir: "/path/to/thumbnails" })

                expect(response.status).toBe(200)
                expect(mockContext.fetchImage).toHaveBeenCalledWith("/path/to/thumbnails", true)
            })

            it("should return 400 when no path provided", async () => {
                const response = await request(app)
                    .put("/api/stream/thumbnail")
                    .send({})

                expect(response.status).toBe(400)
                expect(response.body.error).toContain("pathFile or pathDir is required")
            })
        })

        describe("PUT /api/stream/timestamps", () => {
            it("should update timestamps", async () => {
                const response = await request(app)
                    .put("/api/stream/timestamps")
                    .send({ timestampTitle: "00:00 Intro" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(mockContext.updateDescription).toHaveBeenCalled()
            })
        })
    })

    describe("Playlist Endpoints", () => {
        describe("GET /api/playlists", () => {
            it("should return playlists by name", async () => {
                const response = await request(app)
                    .get("/api/playlists")
                    .query({ name: "Gaming" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.data).toBeInstanceOf(Array)
                expect(mockContext.getPlaylists).toHaveBeenCalledWith(["Gaming"])
            })

            it("should handle multiple playlist names", async () => {
                const response = await request(app)
                    .get("/api/playlists")
                    .query({ name: ["Gaming", "Live"] })

                expect(response.status).toBe(200)
                expect(mockContext.getPlaylists).toHaveBeenCalledWith(["Gaming", "Live"])
            })

            it("should handle empty query", async () => {
                const response = await request(app).get("/api/playlists")

                expect(response.status).toBe(200)
                expect(mockContext.getPlaylists).toHaveBeenCalledWith([])
            })
        })

        describe("GET /api/playlist", () => {
            it("should return single playlist ID", async () => {
                const response = await request(app)
                    .get("/api/playlist")
                    .query({ name: "Gaming" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.data.id).toBe("playlist-1")
            })

            it("should return 400 when name is missing", async () => {
                const response = await request(app).get("/api/playlist")

                expect(response.status).toBe(400)
                expect(response.body.error).toContain("name is required")
            })
        })
    })

    describe("Vertical Endpoints", () => {
        describe("GET /api/verticals/saved", () => {
            it("should return saved vertical info", async () => {
                const response = await request(app).get("/api/verticals/saved")

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.data).toBeDefined()
            })

            it("should return 404 when no vertical found", async () => {
                mockContext = createMockApiContext()
                mockContext.streamLibrary.findLastVertical = jest.fn<() => unknown>().mockReturnValue(null)
                setApiContext(mockContext)
                app = createServer()

                const response = await request(app).get("/api/verticals/saved")

                expect(response.status).toBe(404)
                expect(response.body.error).toContain("No vertical found")
            })
        })

        describe("PUT /api/verticals/info", () => {
            it("should update vertical info", async () => {
                const response = await request(app)
                    .put("/api/verticals/info")
                    .send({ title: "New Vertical Title", description: "New Description" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
            })

            it("should accept only title", async () => {
                const response = await request(app)
                    .put("/api/verticals/info")
                    .send({ title: "New Title" })

                expect(response.status).toBe(200)
            })

            it("should return 400 when neither provided", async () => {
                const response = await request(app)
                    .put("/api/verticals/info")
                    .send({})

                expect(response.status).toBe(400)
            })
        })

        describe("POST /api/verticals/upload", () => {
            it("should upload verticals", async () => {
                const response = await request(app).post("/api/verticals/upload")

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.message).toContain("Uploaded")
                expect(mockContext.uploadVerticalsToYoutube).toHaveBeenCalled()
            })
        })
    })

    describe("Settings Endpoints", () => {
        describe("GET /api/settings", () => {
            it("should return stream settings", async () => {
                const response = await request(app).get("/api/settings")

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
                expect(response.body.data).toBeDefined()
            })
        })

        describe("PUT /api/settings", () => {
            it("should update vertical path", async () => {
                const response = await request(app)
                    .put("/api/settings")
                    .send({ verticalPath: "/new/path" })

                expect(response.status).toBe(200)
                expect(response.body.success).toBe(true)
            })

            it("should update visibility", async () => {
                const response = await request(app)
                    .put("/api/settings")
                    .send({ verticalVisibility: "unlisted" })

                expect(response.status).toBe(200)
            })

            it("should update link settings", async () => {
                const response = await request(app)
                    .put("/api/settings")
                    .send({
                        verticalAddLinkToVideo: true,
                        verticalLinkOffset: 30
                    })

                expect(response.status).toBe(200)
            })
        })
    })

    describe("Dock Redirect Endpoint", () => {
        describe("PUT /api/dock-redirect", () => {
            it("should return 400 when pathFile is missing", async () => {
                const response = await request(app)
                    .put("/api/dock-redirect")
                    .send({})

                expect(response.status).toBe(400)
                expect(response.body.error).toContain("pathFile is required")
            })
        })
    })

    describe("Error Handling", () => {
        it("should return 500 on internal error", async () => {
            mockContext = createMockApiContext({
                getLiveBroadcast: jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error("API error"))
            })
            setApiContext(mockContext)
            app = createServer()

            const response = await request(app).get("/api/stream/info")

            expect(response.status).toBe(500)
            expect(response.body.success).toBe(false)
            expect(response.body.error).toBe("API error")
        })
    })
})
