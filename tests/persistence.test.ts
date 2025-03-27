import { describe, it, expect } from "@jest/globals"
import { extractAndCompareDateTime } from "../src/persistence"

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
})