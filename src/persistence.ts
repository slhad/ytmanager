/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { youtube_v3 } from "googleapis"
import { DateTime, Duration } from "luxon"

// Goal of this file is to keep parameters and history saved on disk

const TIME_ZONE_OFFSET = new Date().getTimezoneOffset() * 60

const log = (obj: any, msg?: string) => {
    const data = JSON.stringify(obj, undefined, 3)
    const prefix = msg ? `${msg} : ` : ""
    console.log(`${prefix}${data}`)
}

export const defaultYTUrlWatch = "https://www.youtube.com/watch?v="

export type Vertical = {
    id: string, // Should be YT video once uploaded
    name: string,
    title: string,
    description: string,
    tags: string[],
    categoryId?: string,
    startTime: number,
    uploaded: boolean
}

export type Stream = {
    id: string,
    title: string[],
    description: string[],
    tags: string[],
    categoryId: string,
    verticals: Record<string, Vertical>,
    startTime: string,
    timestamps: string
}
export type StreamLib = {
    verticalsOptions: {
        path: string,
        addLinkToVideo: boolean,
        offsetLinkToVideoInSeconds: number,
        visibility: "public" | "unlisted" | "private"
    },
    pageDock: string,
    thumbPath: string,
    watchUrl: string,
    timestampsPath: string,
    streams: Record<string, Stream>
}

const streamLibFile = "streamLib.json"
const readStreamLib = (): StreamLib | void => {
    try {
        const data = readFileSync(streamLibFile).toString()
        return JSON.parse(data) as StreamLib
    } catch (e: any) {
        log(`Error reading ${streamLibFile} : ${e.message}`)
    }
    return undefined
}
const writeStreamLib = (streamLib: StreamLib): void => {
    try {
        writeFileSync(streamLibFile, JSON.stringify(streamLib, undefined, 3))
    } catch (e: any) {
        log(`Error writing ${streamLibFile} : ${e.message}`)
    }
}

export const conversionVideoToStreamInfo = (video: youtube_v3.Schema$Video, live?: youtube_v3.Schema$LiveBroadcast): Stream => {
    const stream: Stream = {
        id: video.id ?? "",
        title: [video.snippet?.title ?? ""],
        description: [video.snippet?.description ?? ""],
        tags: video.snippet?.tags || [],
        categoryId: video.snippet?.categoryId ?? "",
        verticals: {},
        startTime: live?.snippet?.publishedAt ?? "",
        timestamps: ""
    }

    return stream
}

export const extractAndCompareDateTime = (fileName: string, isoDateTime: string): number => {
    const fileDateTimeMatch = RegExp(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/).exec(fileName)
    if (!fileDateTimeMatch) {
        throw new Error("Invalid file name format. Expected format: Replay_YYYY-MM-DD_HH-MM-SS.mkv")
    }

    const fileDateTime = DateTime.fromObject({
        year: parseInt(fileDateTimeMatch[1], 10),
        month: parseInt(fileDateTimeMatch[2], 10),
        day: parseInt(fileDateTimeMatch[3], 10),
        hour: parseInt(fileDateTimeMatch[4], 10),
        minute: parseInt(fileDateTimeMatch[5], 10),
        second: parseInt(fileDateTimeMatch[6], 10)
    })

    const isoDateTimeParsed = DateTime.fromISO(isoDateTime)
    if (!isoDateTimeParsed.isValid) {
        throw new Error("Invalid ISO date time format.")
    }

    const differenceInSeconds = fileDateTime.diff(isoDateTimeParsed, "seconds").seconds
    return differenceInSeconds
}

export const convertStreamToVerticalInfo = (stream: Stream, verticalName: string): Vertical => {
    return {
        id: stream.id,
        name: verticalName,
        title: stream.title[0] || "",
        description: stream.description[0] || "",
        tags: stream.tags,
        startTime: extractAndCompareDateTime(verticalName, stream.startTime) || 0,
        uploaded: false
    }
}


const addUniqueStringToArray = (array: string[], value: string): string[] => {
    if (!array.includes(value)) {
        array.unshift(value)
    }
    return array
}

export class StreamLibrary {
    lib: StreamLib

    constructor(sl: StreamLib) {
        this.lib = sl
    }

    static readonly load = () => {
        const sl = readStreamLib()
        if (sl) {
            return new StreamLibrary(sl)
        }
        else {
            return new StreamLibrary({
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
            })
        }
    }

    save = () => writeStreamLib(this.lib)
    addStream = (stream: Stream) => {
        if (!this.lib.streams[stream.id]) {
            this.lib.streams[stream.id] = stream
            log(`Stream with id ${stream.id} added.`)
        } else {
            const oStream = this.lib.streams[stream.id]
            addUniqueStringToArray(oStream.title, stream.title[0])
            addUniqueStringToArray(oStream.description, stream.description[0])
            log(`Stream with id ${stream.id} updated.`)
        }
        return this
    }
    addTimestampsToStream = (streamId: string, timestamps: string) => {
        const stream = this.lib.streams[streamId]
        if (stream) {
            stream.timestamps = timestamps
            log(`Timestamps for Stream with id ${streamId} have been updated.`)
        } else {
            log(`Stream with id ${streamId} does not exist.`)
        }
    }
    addVerticalToStream = (streamId: string, vertical: Vertical) => {
        const stream = this.lib.streams[streamId]
        if (stream) {
            if (stream.verticals[vertical.name]) {
                const v = stream.verticals[vertical.name]
                if (vertical.title) v.title = vertical.title
                if (vertical.description) v.description = vertical.description
            } else {
                stream.verticals[vertical.name] = vertical
            }
            log(`Vertical with id ${vertical.id} added to stream with id ${streamId}.`)
        } else {
            log(`Stream with id ${streamId} does not exist.`)
        }
        return this
    }

    setPageDock(pageDock: string) {
        this.lib.pageDock = pageDock
        return this
    }

    setVerticalsPath(path: string) {
        this.lib.verticalsOptions.path = path
        return this
    }

    setThumbPath(thumbPath: string) {
        this.lib.thumbPath = thumbPath
        return this
    }

    setTimestampsPath(timestampsPath: string) {
        this.lib.timestampsPath = timestampsPath
        return this
    }

    setWatchUrl(watchUrl: string) {
        this.lib.watchUrl = watchUrl
        return this
    }

    findLastVertical(): string | void {
        let latestVerticalFile = undefined
        let latestMtime = 0

        readdirSync(this.lib.verticalsOptions.path).forEach(file => {
            const filePath = join(this.lib.verticalsOptions.path, file)
            const stat = statSync(filePath)
            if (stat.isFile() && stat.mtimeMs > latestMtime) {
                latestMtime = stat.mtimeMs
                latestVerticalFile = file
            }
        })

        return latestVerticalFile
    }

    getUnuploadedVerticals(): Vertical[] {
        const unuploadedVerticals: Vertical[] = []
        for (const streamId in this.lib.streams) {
            const stream = this.lib.streams[streamId]
            for (const verticalId in stream.verticals) {
                const vertical = stream.verticals[verticalId]
                if (!vertical.uploaded) {
                    vertical.categoryId = stream.categoryId
                    unuploadedVerticals.push(vertical)
                }
            }
        }
        return unuploadedVerticals
    }
}