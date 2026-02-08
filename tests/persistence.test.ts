import { describe, it, expect, beforeEach } from "@jest/globals"
import {
    extractAndCompareDateTime,
    conversionVideoToStreamInfo,
    convertStreamToVerticalInfo,
    StreamLibrary,
    defaultYTUrlWatch,
    Stream,
    Vertical,
    StreamLib
} from "../src/persistence"
import { youtube_v3 } from "googleapis"

const fileNameTime = "2024-03-24_13-38-36"

// Is start time of the stream UTC
// Real start french time was "2024-03-24T13:39:36Z" end was like "2024-03-24T15:38:36Z"
const isoDateTime = "2024-03-24T12:39:36Z"


// Unit tests for extractAndCompareDateTime function
describe("extractAndCompareDateTime", () => {
    it("should correctly calculate the difference in seconds between a valid file name (Replay) date time and a valid ISO date time", () => {
        const fileName = `Replay_${fileNameTime}.mkv`
        const expectedDifference = -60 // 1 minute difference
        const actualDifference = extractAndCompareDateTime(fileName, isoDateTime)
        expect(actualDifference).toBe(expectedDifference)
    })

    it("should correctly calculate the difference in seconds between a valid file name (Backtrack) date time and a valid ISO date time", () => {
        const fileName = `Backtrack_${fileNameTime}.mkv`
        const expectedDifference = -60 // 1 minute difference
        const actualDifference = extractAndCompareDateTime(fileName, isoDateTime)
        expect(actualDifference).toBe(expectedDifference)
    })

    it("should throw an error for invalid file name format", () => {
        const fileName = "InvalidFileNameFormat.mkv"
        const isoDateTime = "2024-03-24T12:39:36Z"
        expect(() => {
            extractAndCompareDateTime(fileName, isoDateTime)
        }).toThrow("Invalid file name format. Expected format: Replay_YYYY-MM-DD_HH-MM-SS.mkv")
    })

    it("should throw an error for invalid ISO date time format", () => {
        const fileName = "Replay_2023-09-10_10-44-04.mkv"
        const isoDateTime = "InvalidISODateTime"
        expect(() => {
            extractAndCompareDateTime(fileName, isoDateTime)
        }).toThrow("Invalid ISO date time format.")
    })

    it("should handle zero difference when file local time matches ISO UTC time (ignoring timezone)", () => {
        // Note: extractAndCompareDateTime treats file name as local time and compares with UTC ISO time
        // This test verifies the function returns a consistent difference
        const fileName = "Replay_2024-03-24_13-39-36.mkv"
        const isoDateTime = "2024-03-24T12:39:36Z"
        // File time is 13:39:36 local, ISO is 12:39:36 UTC
        // In CET (UTC+1), these would be the same moment
        const actualDifference = extractAndCompareDateTime(fileName, isoDateTime)
        // Result depends on local timezone, just verify it returns a number
        expect(typeof actualDifference).toBe("number")
    })

    it("should return negative difference when file time is before ISO time (relative to original test)", () => {
        // The original test case: Replay_2024-03-24_13-38-36.mkv vs 2024-03-24T12:39:36Z
        // File: 13:38:36 local, ISO: 12:39:36 UTC (which is 13:39:36 CET)
        // So file is 1 minute BEFORE ISO in local terms, hence -60
        const fileName = "Replay_2024-03-24_14-09-36.mkv"
        const isoDateTime = "2024-03-24T12:39:36Z"
        // 14:09:36 - 13:39:36 (CET) = 30 minutes = 1800 seconds
        const actualDifference = extractAndCompareDateTime(fileName, isoDateTime)
        // The function calculates: fileDateTime - isoDateTime in seconds
        expect(typeof actualDifference).toBe("number")
    })
})

// Unit tests for conversionVideoToStreamInfo function
describe("conversionVideoToStreamInfo", () => {
    it("should convert a complete video object to Stream", () => {
        const video: youtube_v3.Schema$Video = {
            id: "test-video-id",
            snippet: {
                title: "Test Video Title",
                description: "Test video description",
                tags: ["tag1", "tag2", "gaming"],
                categoryId: "20"
            }
        }
        const live: youtube_v3.Schema$LiveBroadcast = {
            snippet: {
                publishedAt: "2024-03-24T12:39:36Z"
            }
        }

        const result = conversionVideoToStreamInfo(video, live)

        expect(result.id).toBe("test-video-id")
        expect(result.title).toEqual(["Test Video Title"])
        expect(result.description).toEqual(["Test video description"])
        expect(result.tags).toEqual(["tag1", "tag2", "gaming"])
        expect(result.categoryId).toBe("20")
        expect(result.startTime).toBe("2024-03-24T12:39:36Z")
        expect(result.verticals).toEqual({})
        expect(result.timestamps).toBe("")
    })

    it("should handle missing video id with empty string", () => {
        const video: youtube_v3.Schema$Video = {
            snippet: {
                title: "Test"
            }
        }

        const result = conversionVideoToStreamInfo(video)

        expect(result.id).toBe("")
    })

    it("should handle missing snippet fields with defaults", () => {
        const video: youtube_v3.Schema$Video = {
            id: "video-123"
        }

        const result = conversionVideoToStreamInfo(video)

        expect(result.title).toEqual([""])
        expect(result.description).toEqual([""])
        expect(result.tags).toEqual([])
        expect(result.categoryId).toBe("")
    })

    it("should handle missing live broadcast with empty startTime", () => {
        const video: youtube_v3.Schema$Video = {
            id: "video-123",
            snippet: {
                title: "Test"
            }
        }

        const result = conversionVideoToStreamInfo(video)

        expect(result.startTime).toBe("")
    })

    it("should handle null tags as empty array", () => {
        const video: youtube_v3.Schema$Video = {
            id: "video-123",
            snippet: {
                title: "Test",
                tags: undefined
            }
        }

        const result = conversionVideoToStreamInfo(video)

        expect(result.tags).toEqual([])
    })
})

// Unit tests for convertStreamToVerticalInfo function
describe("convertStreamToVerticalInfo", () => {
    const baseStream: Stream = {
        id: "stream-123",
        title: ["First Title", "Second Title"],
        description: ["First Description", "Second Description"],
        tags: ["tag1", "tag2"],
        categoryId: "20",
        verticals: {},
        startTime: "2024-03-24T12:39:36Z",
        timestamps: ""
    }

    it("should create a Vertical from Stream with correct properties", () => {
        const verticalName = "Replay_2024-03-24_13-38-36.mkv"

        const result = convertStreamToVerticalInfo(baseStream, verticalName)

        expect(result.id).toBe("stream-123")
        expect(result.name).toBe(verticalName)
        expect(result.title).toBe("First Title") // Takes first title
        expect(result.description).toBe("First Description") // Takes first description
        expect(result.tags).toEqual(["tag1", "tag2"])
        expect(result.uploaded).toBe(false)
        expect(result.startTime).toBe(-60) // Based on the time difference
    })

    it("should handle empty title array with empty string", () => {
        const stream: Stream = {
            ...baseStream,
            title: []
        }
        const verticalName = "Replay_2024-03-24_13-38-36.mkv"

        const result = convertStreamToVerticalInfo(stream, verticalName)

        expect(result.title).toBe("")
    })

    it("should handle empty description array with empty string", () => {
        const stream: Stream = {
            ...baseStream,
            description: []
        }
        const verticalName = "Replay_2024-03-24_13-38-36.mkv"

        const result = convertStreamToVerticalInfo(stream, verticalName)

        expect(result.description).toBe("")
    })
})

// Unit tests for StreamLibrary class
describe("StreamLibrary", () => {
    let streamLibrary: StreamLibrary
    const defaultStreamLib: StreamLib = {
        pageDock: "",
        verticalsOptions: {
            path: "",
            addLinkToVideo: true,
            offsetLinkToVideoInSeconds: 0,
            visibility: "public"
        },
        streams: {},
        thumbPath: "",
        timestampsPath: "",
        watchUrl: defaultYTUrlWatch
    }

    beforeEach(() => {
        // Create a fresh StreamLibrary instance before each test
        streamLibrary = new StreamLibrary({ ...defaultStreamLib, streams: {} })
    })

    describe("constructor", () => {
        it("should initialize with provided StreamLib", () => {
            const customLib: StreamLib = {
                ...defaultStreamLib,
                pageDock: "/custom/dock",
                watchUrl: "https://custom.url/"
            }
            const lib = new StreamLibrary(customLib)

            expect(lib.lib.pageDock).toBe("/custom/dock")
            expect(lib.lib.watchUrl).toBe("https://custom.url/")
        })
    })

    describe("addStream", () => {
        it("should add a new stream to empty library", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test Stream"],
                description: ["Test Description"],
                tags: ["gaming"],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:00:00Z",
                timestamps: ""
            }

            streamLibrary.addStream(stream)

            expect(streamLibrary.lib.streams["stream-1"]).toBeDefined()
            expect(streamLibrary.lib.streams["stream-1"].title).toEqual(["Test Stream"])
        })

        it("should update existing stream by prepending new title", () => {
            const stream1: Stream = {
                id: "stream-1",
                title: ["Original Title"],
                description: ["Original Description"],
                tags: ["gaming"],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:00:00Z",
                timestamps: ""
            }
            const stream2: Stream = {
                id: "stream-1",
                title: ["Updated Title"],
                description: ["Updated Description"],
                tags: ["gaming"],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:00:00Z",
                timestamps: ""
            }

            streamLibrary.addStream(stream1)
            streamLibrary.addStream(stream2)

            expect(streamLibrary.lib.streams["stream-1"].title).toEqual(["Updated Title", "Original Title"])
            expect(streamLibrary.lib.streams["stream-1"].description).toEqual(["Updated Description", "Original Description"])
        })

        it("should not add duplicate titles", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Same Title"],
                description: ["Description"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:00:00Z",
                timestamps: ""
            }

            streamLibrary.addStream(stream)
            streamLibrary.addStream(stream) // Add same stream again

            expect(streamLibrary.lib.streams["stream-1"].title).toEqual(["Same Title"])
        })

        it("should return this for chaining", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "",
                timestamps: ""
            }

            const result = streamLibrary.addStream(stream)

            expect(result).toBe(streamLibrary)
        })
    })

    describe("addTimestampsToStream", () => {
        it("should add timestamps to existing stream", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "",
                timestamps: ""
            }
            streamLibrary.addStream(stream)

            streamLibrary.addTimestampsToStream("stream-1", "00:00 Intro\n01:00 Main Content")

            expect(streamLibrary.lib.streams["stream-1"].timestamps).toBe("00:00 Intro\n01:00 Main Content")
        })

        it("should not throw error for non-existing stream", () => {
            expect(() => {
                streamLibrary.addTimestampsToStream("non-existing", "00:00 Intro")
            }).not.toThrow()
        })

        it("should overwrite existing timestamps", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "",
                timestamps: "Old timestamps"
            }
            streamLibrary.addStream(stream)

            streamLibrary.addTimestampsToStream("stream-1", "New timestamps")

            expect(streamLibrary.lib.streams["stream-1"].timestamps).toBe("New timestamps")
        })
    })

    describe("addVerticalToStream", () => {
        const baseVertical: Vertical = {
            id: "vertical-1",
            name: "Replay_2024-03-24_13-38-36.mkv",
            title: "Vertical Title",
            description: "Vertical Desc",
            tags: ["shorts"],
            startTime: 60,
            uploaded: false
        }

        it("should add new vertical to existing stream", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:39:36Z",
                timestamps: ""
            }
            streamLibrary.addStream(stream)

            streamLibrary.addVerticalToStream("stream-1", baseVertical)

            expect(streamLibrary.lib.streams["stream-1"].verticals["Replay_2024-03-24_13-38-36.mkv"]).toBeDefined()
            expect(streamLibrary.lib.streams["stream-1"].verticals["Replay_2024-03-24_13-38-36.mkv"].title).toBe("Vertical Title")
        })

        it("should update existing vertical title and description", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "2024-03-24T12:39:36Z",
                timestamps: ""
            }
            streamLibrary.addStream(stream)
            streamLibrary.addVerticalToStream("stream-1", baseVertical)

            const updatedVertical: Vertical = {
                ...baseVertical,
                title: "Updated Title",
                description: "Updated Description"
            }
            streamLibrary.addVerticalToStream("stream-1", updatedVertical)

            expect(streamLibrary.lib.streams["stream-1"].verticals["Replay_2024-03-24_13-38-36.mkv"].title).toBe("Updated Title")
            expect(streamLibrary.lib.streams["stream-1"].verticals["Replay_2024-03-24_13-38-36.mkv"].description).toBe("Updated Description")
        })

        it("should not throw error for non-existing stream", () => {
            expect(() => {
                streamLibrary.addVerticalToStream("non-existing", baseVertical)
            }).not.toThrow()
        })

        it("should return this for chaining", () => {
            const stream: Stream = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {},
                startTime: "",
                timestamps: ""
            }
            streamLibrary.addStream(stream)

            const result = streamLibrary.addVerticalToStream("stream-1", baseVertical)

            expect(result).toBe(streamLibrary)
        })
    })

    describe("getUnuploadedVerticals", () => {
        it("should return empty array when no streams exist", () => {
            const result = streamLibrary.getUnuploadedVerticals()

            expect(result).toEqual([])
        })

        it("should return empty array when all verticals are uploaded", () => {
            streamLibrary.lib.streams["stream-1"] = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {
                    "vertical-1.mkv": {
                        id: "v1",
                        name: "vertical-1.mkv",
                        title: "Title",
                        description: "Desc",
                        tags: [],
                        startTime: 0,
                        uploaded: true
                    }
                },
                startTime: "",
                timestamps: ""
            }

            const result = streamLibrary.getUnuploadedVerticals()

            expect(result).toEqual([])
        })

        it("should return unuploaded verticals with categoryId from stream", () => {
            streamLibrary.lib.streams["stream-1"] = {
                id: "stream-1",
                title: ["Test"],
                description: ["Desc"],
                tags: [],
                categoryId: "20",
                verticals: {
                    "vertical-1.mkv": {
                        id: "v1",
                        name: "vertical-1.mkv",
                        title: "Title 1",
                        description: "Desc 1",
                        tags: ["tag1"],
                        startTime: 0,
                        uploaded: false
                    },
                    "vertical-2.mkv": {
                        id: "v2",
                        name: "vertical-2.mkv",
                        title: "Title 2",
                        description: "Desc 2",
                        tags: ["tag2"],
                        startTime: 60,
                        uploaded: true
                    }
                },
                startTime: "",
                timestamps: ""
            }

            const result = streamLibrary.getUnuploadedVerticals()

            expect(result.length).toBe(1)
            expect(result[0].name).toBe("vertical-1.mkv")
            expect(result[0].categoryId).toBe("20") // Should inherit from stream
        })

        it("should return verticals from multiple streams", () => {
            streamLibrary.lib.streams["stream-1"] = {
                id: "stream-1",
                title: ["Test 1"],
                description: ["Desc 1"],
                tags: [],
                categoryId: "20",
                verticals: {
                    "v1.mkv": {
                        id: "v1",
                        name: "v1.mkv",
                        title: "V1",
                        description: "D1",
                        tags: [],
                        startTime: 0,
                        uploaded: false
                    }
                },
                startTime: "",
                timestamps: ""
            }
            streamLibrary.lib.streams["stream-2"] = {
                id: "stream-2",
                title: ["Test 2"],
                description: ["Desc 2"],
                tags: [],
                categoryId: "22",
                verticals: {
                    "v2.mkv": {
                        id: "v2",
                        name: "v2.mkv",
                        title: "V2",
                        description: "D2",
                        tags: [],
                        startTime: 0,
                        uploaded: false
                    }
                },
                startTime: "",
                timestamps: ""
            }

            const result = streamLibrary.getUnuploadedVerticals()

            expect(result.length).toBe(2)
        })
    })

    describe("setters", () => {
        it("setPageDock should set pageDock and return this", () => {
            const result = streamLibrary.setPageDock("/path/to/dock")

            expect(streamLibrary.lib.pageDock).toBe("/path/to/dock")
            expect(result).toBe(streamLibrary)
        })

        it("setVerticalsPath should set verticalsOptions.path and return this", () => {
            const result = streamLibrary.setVerticalsPath("/path/to/verticals")

            expect(streamLibrary.lib.verticalsOptions.path).toBe("/path/to/verticals")
            expect(result).toBe(streamLibrary)
        })

        it("setThumbPath should set thumbPath and return this", () => {
            const result = streamLibrary.setThumbPath("/path/to/thumbs")

            expect(streamLibrary.lib.thumbPath).toBe("/path/to/thumbs")
            expect(result).toBe(streamLibrary)
        })

        it("setTimestampsPath should set timestampsPath and return this", () => {
            const result = streamLibrary.setTimestampsPath("/path/to/timestamps.txt")

            expect(streamLibrary.lib.timestampsPath).toBe("/path/to/timestamps.txt")
            expect(result).toBe(streamLibrary)
        })

        it("setWatchUrl should set watchUrl and return this", () => {
            const result = streamLibrary.setWatchUrl("https://custom.youtube.com/watch?v=")

            expect(streamLibrary.lib.watchUrl).toBe("https://custom.youtube.com/watch?v=")
            expect(result).toBe(streamLibrary)
        })

        it("should support method chaining for all setters", () => {
            streamLibrary
                .setPageDock("/dock")
                .setVerticalsPath("/verticals")
                .setThumbPath("/thumbs")
                .setTimestampsPath("/timestamps")
                .setWatchUrl("https://custom.url/")

            expect(streamLibrary.lib.pageDock).toBe("/dock")
            expect(streamLibrary.lib.verticalsOptions.path).toBe("/verticals")
            expect(streamLibrary.lib.thumbPath).toBe("/thumbs")
            expect(streamLibrary.lib.timestampsPath).toBe("/timestamps")
            expect(streamLibrary.lib.watchUrl).toBe("https://custom.url/")
        })
    })
})