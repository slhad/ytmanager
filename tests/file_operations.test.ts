import { describe, it, expect, beforeEach, mock } from "bun:test"
import { YouTubeService } from "../src/service"

// Mock fs module
const mockReaddirSync = mock()
const mockStatSync = mock()
const mockReadFileSync = mock()

mock.module("fs", () => ({
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mock(),
    createReadStream: mock()
}))

describe("File Operations", () => {
    let service: YouTubeService

    beforeEach(() => {
        service = new YouTubeService(null)
        mockReaddirSync.mockReset()
        mockStatSync.mockReset()
        mockReadFileSync.mockReset()
    })

    describe("fetchFile", () => {
        it("should read file directly when isDir is false", () => {
            const filePath = "/path/to/file.txt"
            const fileContent = Buffer.from("file content")
            mockReadFileSync.mockReturnValue(fileContent)

            const result = service.fetchFile(filePath, ["txt"], false)

            expect(mockReadFileSync).toHaveBeenCalledWith(filePath)
            expect(result).toBe(fileContent)
        })

        it("should read most recent file from directory when isDir is true", () => {
            const dirPath = "/path/to/dir"
            const files = ["file1.txt", "file2.txt", "file3.txt"]
            
            mockReaddirSync.mockReturnValue(files)
            // file3 is most recent (1700000000000), file2 is older, file1 is oldest
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1600000000000 }) // file1
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // file2
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // file3
            
            const fileContent = Buffer.from("latest file content")
            mockReadFileSync.mockReturnValue(fileContent)

            const result = service.fetchFile(dirPath, ["txt"], true)

            expect(mockReaddirSync).toHaveBeenCalledWith(dirPath)
            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/file3.txt")
            expect(result).toBe(fileContent)
        })

        it("should filter files by allowed extensions", () => {
            const dirPath = "/path/to/dir"
            const files = ["image.png", "doc.pdf", "photo.jpg", "data.json"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // image.png
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // photo.jpg
            
            mockReadFileSync.mockReturnValue(Buffer.from("image data"))

            service.fetchFile(dirPath, ["png", "jpg"], true)

            // Should only check stat for png and jpg files, not pdf or json
            expect(mockStatSync).toHaveBeenCalledTimes(2)
        })

        it("should handle files with multiple dots in name", () => {
            const dirPath = "/path/to/dir"
            const files = ["archive.backup.tar.gz", "document.final.pdf"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1700000000000 })
                .mockReturnValueOnce({ mtimeMs: 1650000000000 })
            
            mockReadFileSync.mockReturnValue(Buffer.from("pdf content"))

            const result = service.fetchFile(dirPath, ["pdf"], true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/document.final.pdf")
        })

        it("should handle case-insensitive extensions", () => {
            const dirPath = "/path/to/dir"
            const files = ["IMAGE.PNG", "photo.jpg", "Pic.JPEG"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // IMAGE.PNG
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // Pic.JPEG
            
            mockReadFileSync.mockReturnValue(Buffer.from("image data"))

            const result = service.fetchFile(dirPath, ["png", "jpeg"], true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/IMAGE.PNG")
        })

        it("should handle empty directory", () => {
            const dirPath = "/path/to/empty"
            
            mockReaddirSync.mockReturnValue([])

            expect(() => {
                service.fetchFile(dirPath, ["txt"], true)
            }).toThrow("No files with extensions txt found in directory: /path/to/empty")
        })

        it("should handle directory with no matching files", () => {
            const dirPath = "/path/to/dir"
            const files = ["video.mp4", "doc.pdf"]
            
            mockReaddirSync.mockReturnValue(files)

            expect(() => {
                service.fetchFile(dirPath, ["png", "jpg"], true)
            }).toThrow("No files with extensions png, jpg found in directory: /path/to/dir")
        })

        it("should handle single file in directory", () => {
            const dirPath = "/path/to/dir"
            const files = ["onlyfile.txt"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync.mockReturnValueOnce({ mtimeMs: 1700000000000 })
            
            const fileContent = Buffer.from("only file content")
            mockReadFileSync.mockReturnValue(fileContent)

            const result = service.fetchFile(dirPath, ["txt"], true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/onlyfile.txt")
            expect(result).toBe(fileContent)
        })
    })

    describe("fetchImage", () => {
        it("should call fetchFile with image extensions", () => {
            const filePath = "/path/to/image.png"
            const imageContent = Buffer.from("png data")
            mockReadFileSync.mockReturnValue(imageContent)

            const result = service.fetchImage(filePath, false)

            expect(mockReadFileSync).toHaveBeenCalledWith(filePath)
            expect(result).toBe(imageContent)
        })

        it("should fetch most recent image from directory", () => {
            const dirPath = "/path/to/images"
            const files = ["old.png", "newer.jpg", "newest.jpeg"]
            
            mockReaddirSync.mockReturnValue(files)
            // Mock order matches filtered array: old.png, newer.jpg, newest.jpeg
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1600000000000 }) // old.png
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // newer.jpg
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // newest.jpeg
            
            const imageContent = Buffer.from("newest image")
            mockReadFileSync.mockReturnValue(imageContent)

            const result = service.fetchImage(dirPath, true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/images/newest.jpeg")
            expect(result).toBe(imageContent)
        })

        it("should only accept png, jpeg, and jpg extensions", () => {
            const dirPath = "/path/to/mixed"
            const files = ["photo.png", "video.mp4", "doc.pdf", "image.gif", "pic.jpg"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // photo.png
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // pic.jpg
            
            mockReadFileSync.mockReturnValue(Buffer.from("image data"))

            service.fetchImage(dirPath, true)

            // Should only stat png and jpg files
            expect(mockStatSync).toHaveBeenCalledTimes(2)
        })
    })

    describe("fetchVideo", () => {
        it("should call fetchFile with video extensions", () => {
            const filePath = "/path/to/video.mp4"
            const videoContent = Buffer.from("mp4 data")
            mockReadFileSync.mockReturnValue(videoContent)

            const result = service.fetchVideo(filePath, false)

            expect(mockReadFileSync).toHaveBeenCalledWith(filePath)
            expect(result).toBe(videoContent)
        })

        it("should fetch most recent video from directory", () => {
            const dirPath = "/path/to/videos"
            const files = ["old.mkv", "newer.mp4", "newest.mov"]
            
            mockReaddirSync.mockReturnValue(files)
            // Mock order matches filtered array: old.mkv, newer.mp4, newest.mov
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1600000000000 }) // old.mkv
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // newer.mp4
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // newest.mov
            
            const videoContent = Buffer.from("newest video")
            mockReadFileSync.mockReturnValue(videoContent)

            const result = service.fetchVideo(dirPath, true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/videos/newest.mov")
            expect(result).toBe(videoContent)
        })

        it("should accept mkv, mp4, mov, and avi extensions", () => {
            const dirPath = "/path/to/videos"
            const files = ["movie.mkv", "clip.mp4", "recording.mov", "backup.avi", "image.png"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1700000000000 }) // movie.mkv
                .mockReturnValueOnce({ mtimeMs: 1650000000000 }) // clip.mp4
                .mockReturnValueOnce({ mtimeMs: 1600000000000 }) // recording.mov
                .mockReturnValueOnce({ mtimeMs: 1550000000000 }) // backup.avi
            
            mockReadFileSync.mockReturnValue(Buffer.from("video data"))

            service.fetchVideo(dirPath, true)

            // Should only stat video files, not image.png
            expect(mockStatSync).toHaveBeenCalledTimes(4)
        })
    })

    describe("file sorting in directory mode", () => {
        it("should correctly sort files by modification time descending", () => {
            const dirPath = "/path/to/dir"
            const files = ["a.txt", "b.txt", "c.txt", "d.txt"]
            
            mockReaddirSync.mockReturnValue(files)
            // c is newest (4000), b is second (3000), d is third (2000), a is oldest (1000)
            // Mock order matches files array: a, b, c, d
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1000 }) // a
                .mockReturnValueOnce({ mtimeMs: 3000 }) // b
                .mockReturnValueOnce({ mtimeMs: 4000 }) // c
                .mockReturnValueOnce({ mtimeMs: 2000 }) // d
            
            mockReadFileSync.mockReturnValue(Buffer.from("content"))

            service.fetchFile(dirPath, ["txt"], true)

            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/c.txt")
        })

        it("should handle files with same modification time", () => {
            const dirPath = "/path/to/dir"
            const files = ["first.txt", "second.txt"]
            
            mockReaddirSync.mockReturnValue(files)
            mockStatSync
                .mockReturnValueOnce({ mtimeMs: 1000 }) // first
                .mockReturnValueOnce({ mtimeMs: 1000 }) // second
            
            mockReadFileSync.mockReturnValue(Buffer.from("content"))

            // When equal, sort returns 0, first element is picked
            service.fetchFile(dirPath, ["txt"], true)

            // Since mtime is equal, first.txt stays first in array
            expect(mockReadFileSync).toHaveBeenCalledWith("/path/to/dir/first.txt")
        })
    })

    describe("error handling", () => {
        it("should propagate file not found errors", () => {
            const filePath = "/nonexistent/file.txt"
            mockReadFileSync.mockImplementation(() => {
                throw new Error("ENOENT: no such file or directory")
            })

            expect(() => {
                service.fetchFile(filePath, ["txt"], false)
            }).toThrow("ENOENT: no such file or directory")
        })

        it("should propagate permission errors", () => {
            const filePath = "/restricted/file.txt"
            mockReadFileSync.mockImplementation(() => {
                throw new Error("EACCES: permission denied")
            })

            expect(() => {
                service.fetchFile(filePath, ["txt"], false)
            }).toThrow("EACCES: permission denied")
        })

        it("should propagate directory read errors", () => {
            const dirPath = "/nonexistent/dir"
            mockReaddirSync.mockImplementation(() => {
                throw new Error("ENOENT: no such file or directory")
            })

            expect(() => {
                service.fetchFile(dirPath, ["txt"], true)
            }).toThrow("ENOENT: no such file or directory")
        })

        it("should propagate stat errors", () => {
            const dirPath = "/path/to/dir"
            mockReaddirSync.mockReturnValue(["file.txt"])
            mockStatSync.mockImplementation(() => {
                throw new Error("EACCES: permission denied")
            })

            expect(() => {
                service.fetchFile(dirPath, ["txt"], true)
            }).toThrow("EACCES: permission denied")
        })
    })
})
