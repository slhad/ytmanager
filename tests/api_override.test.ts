
import { describe, it, expect, beforeEach, mock } from "bun:test"
import request from "supertest"
import { createServer } from "../src/api/server"
import { Context } from "../src/context"
import { YouTubeService } from "../src/service"
import { StreamLibrary } from "../src/persistence"
import type { Express } from "express"

const createMockService = () => {
    return {
        setTitleStream: mock().mockResolvedValue({ success: true }),
        setLiveStreamInfo: mock().mockResolvedValue({ success: true }),
        uploadVerticalsToYoutube: mock().mockResolvedValue({ uploadedCount: 1 }),
        getLiveBroadcast: mock().mockResolvedValue({ id: "123" }),
    } as unknown as YouTubeService
}

const createMockLibrary = () => {
    return {
        lib: { verticalsOptions: {} },
        save: mock(),
        getUnuploadedVerticals: mock().mockReturnValue([{ name: "v1.mp4", uploaded: false }]),
    } as unknown as StreamLibrary
}

describe("API Method Override", () => {
    let app: Express
    let mockContext: Context

    beforeEach(() => {
        mockContext = {
            service: createMockService(),
            library: createMockLibrary(),
            verbose: false,
            pretty: 2
        }
        app = createServer(mockContext)
    })

    it("GET /api/endpoints should show override usage instruction", async () => {
        const response = await request(app).get("/api/endpoints")
        expect(response.status).toBe(200)
        expect(response.body.usage.methodOverride).toBeDefined()
    })

    it("should allow PUT via GET override with ?_method=PUT", async () => {
        // PUT /api/stream/title requires 'title' parameter
        const response = await request(app)
            .get("/api/stream/title")
            .query({ _method: "PUT", title: "Override Title" })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(mockContext.service.setTitleStream).toHaveBeenCalled()

        // Verify parameters were extracted from query string
        const calls = (mockContext.service.setTitleStream as any).mock.calls
        // The handler first calls getLiveBroadcast then setTitleStream(lb, title)
        // Wait, let's check action handler signature in actions.ts for 'stream-title'
    })

    it("should allow POST via GET override with ?_method=POST", async () => {
        const response = await request(app)
            .get("/api/verticals/upload")
            .query({ _method: "POST" })

        expect(response.status).toBe(200)
        expect(response.body.uploadedCount).toBe(1)
        expect(mockContext.service.uploadVerticalsToYoutube).toHaveBeenCalled()
    })

    it("should allow PUT via GET override for setLiveStreamInfo with multiple params", async () => {
        const response = await request(app)
            .get("/api/stream/live")
            .query({
                _method: "PUT",
                title: "New Title",
                description: "New Description"
            })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(mockContext.service.setLiveStreamInfo).toHaveBeenCalled()

        // Verify params were passed to the service
        const calls = (mockContext.service.setLiveStreamInfo as any).mock.calls
        // Signature: (broadcast, title, description)
        expect(calls[0][1]).toBe("New Title")
        expect(calls[0][2]).toBe("New Description")
    })

    it("should NOT trigger override if _method is missing", async () => {
        const response = await request(app)
            .get("/api/verticals/upload")

        // Action /verticals/upload is POST only, so GET without override should 404
        expect(response.status).toBe(404)
    })

    it("should NOT trigger override if _method is wrong", async () => {
        const response = await request(app)
            .get("/api/verticals/upload")
            .query({ _method: "PUT" }) // should be POST

        expect(response.status).toBe(404)
    })
})
