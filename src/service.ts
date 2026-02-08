
import { google, youtube_v3 } from "googleapis"
import { readFileSync, writeFileSync, readdirSync, statSync, createReadStream } from "fs"
import { join } from "path"
import imageminPngquant from "imagemin-pngquant"
import { StreamLibrary, convertStreamToVerticalInfo, conversionVideoToStreamInfo, Vertical, StreamLib } from "./persistence"

const log = (obj: unknown, msg?: string) => {
    // Basic logging, can be improved
    const prefix = msg ? `${msg} : ` : ""
    console.log(`${prefix}${JSON.stringify(obj, undefined, 2)}`)
}

export type CurrentStreamSettings = {
    language?: string
    languageSub?: string
    playlists?: string[]
    tags?: string[]
    category?: string,
    subject?: string,
    title?: string,
    _titleOriginal?: string,
    description?: string,
    _descriptionOrignal?: string,
    subjectBeforeTitle?: boolean,
    subjectAfterTitle?: boolean,
    subjectSeparator?: string,
    subjectAddToTags?: boolean,
    tagsAddDescription?: boolean,
    tagsDescriptionWithHashTag?: boolean,
    tagsDescriptionNewLine?: boolean,
    tagsDescriptionWhiteSpace?: string,
    timestampsTitle?: string
    timestamps?: string
}

export class YouTubeService {
    private youtube: youtube_v3.Youtube
    private auth: any // OAuth2Client

    constructor(auth: any) {
        this.auth = auth
        this.youtube = google.youtube({
            version: "v3",
            auth: auth
        })
    }

    async setTitleStream(liveBroadcast: youtube_v3.Schema$LiveBroadcast, streamTitle: string) {
        if (liveBroadcast) {
            const update = {
                part: ["id", "snippet", "status", "contentDetails"],
                requestBody: {
                    id: liveBroadcast.id,
                    snippet: {
                        title: streamTitle,
                        scheduledStartTime: liveBroadcast.snippet?.scheduledStartTime
                    },
                    status: {
                        privacyStatus: liveBroadcast.status?.privacyStatus,
                    },
                    contentDetails: {
                        monitorStream: {
                            enableMonitorStream: liveBroadcast.contentDetails?.monitorStream?.enableMonitorStream,
                            broadcastStreamDelayMs: liveBroadcast.contentDetails?.monitorStream?.broadcastStreamDelayMs
                        }

                    }
                }
            }
            log(update, "Update livebroadcast title")
            await this.youtube.liveBroadcasts.update(update)
        }
    }

    async uploadVerticalsToYoutube(verticals: Vertical[], verticalConfig: StreamLib["verticalsOptions"]) {
        for (const vertical of verticals) {

            const description = vertical.description.toLowerCase().includes("#shorts")
                ? vertical.description
                : `${vertical.description} #shorts`

            const videoRequestBody: youtube_v3.Schema$Video = {
                snippet: {
                    title: vertical.title,
                    description: description,
                    tags: vertical.tags,
                    categoryId: vertical.categoryId || "20"
                },
                status: {
                    privacyStatus: verticalConfig.visibility
                }
            }

            const media = {
                body: createReadStream(join(verticalConfig.path, vertical.name))
            }

            try {
                const response = await this.youtube.videos.insert({
                    part: ["snippet", "status"],
                    requestBody: videoRequestBody,
                    media: media,
                })

                if (response.data.id) {
                    console.log(`Uploaded vertical ${vertical.name} with video ID: ${response.data.id}`)
                    vertical.uploaded = true
                    vertical.id = response.data.id
                } else {
                    console.error(`Failed to upload vertical ${vertical.name}`)
                }
            } catch (error) {
                console.error(`Error uploading vertical ${vertical.name}:`, error)
            }
        }
    }

    async updateVideo(video: youtube_v3.Schema$Video, parameters: CurrentStreamSettings) {
        const update: youtube_v3.Params$Resource$Videos$Update = {
            part: ["id"],
            requestBody: {
                id: video.id
            }
        }

        if (parameters) {
            if (
                parameters.category
                || parameters.language
                || parameters.playlists
                || parameters.tags
                || parameters.languageSub
                || parameters.title
                || parameters.description
            ) {

                if (!update.requestBody) {
                    update.requestBody = {}
                }

                if (!update.requestBody.snippet) {
                    update.part?.push("snippet")

                    if (!update.requestBody.snippet && video.snippet) {
                        update.requestBody.snippet = video.snippet
                    }

                    if (update.requestBody.snippet) {
                        update.requestBody.snippet.title = parameters.title || video.snippet?.title
                        update.requestBody.snippet.description = parameters.description || video.snippet?.description

                    } else {
                        update.requestBody.snippet = {
                            title: parameters.title || video.snippet?.title,
                            description: parameters.description || video.snippet?.description
                        }
                    }
                }

                if (parameters.language) {
                    update.requestBody.snippet.defaultAudioLanguage = parameters.language
                }

                if (parameters.languageSub) {
                    update.requestBody.snippet.defaultLanguage = parameters.languageSub
                }


                if (parameters.category) {
                    update.requestBody.snippet.categoryId = parameters.category
                }

                if (parameters.tags) {
                    update.requestBody.snippet.tags = parameters.tags
                    if (parameters.tags.some((tag) => tag.toLocaleLowerCase() === "mature")) {
                        // TODO find a wait to make google/youtube accept modification on contentRating.ytRating 
                        update.part?.push("contentDetails")

                        if (!update.requestBody.contentDetails) {
                            update.requestBody.contentDetails = {}
                        }

                        if (!update.requestBody.contentDetails.contentRating) {
                            update.requestBody.contentDetails.contentRating = {}
                        }
                        update.requestBody.contentDetails.contentRating.ytRating = "ytAgeRestricted"
                    }
                }

                await this.youtube.videos.update(update)
            }
        }

    }

    async getLiveBroadcast() {
        const { data } = await this.youtube.liveBroadcasts.list({
            part: ["id", "snippet", "status", "contentDetails"],
            mine: true,
            maxResults: 1,
            broadcastType: "all"
        })
        log(data, "Livebroadcast list")
        return data.items && data.items[0] || {}
    }

    async getVideo(videoId: string) {
        const { data } = await this.youtube.videos.list({
            part: ["id", "snippet", "statistics", "contentDetails"],
            id: [videoId]
        })
        log(data, "Video list")
        return data.items && data.items[0] || {}
    }

    async getCategoryId(categoryName: string, regionCode = "fr") {
        const resp = await this.youtube.videoCategories.list({
            part: ["snippet"],
            regionCode
        })
        const data = resp.data && resp.data.items && resp.data.items.length ? resp.data.items : []
        return data.find(vc => vc.snippet?.title === categoryName)?.id || undefined
    }

    async getPlaylists(playlistNames: string[]): Promise<{ id: string, name: string }[]> {
        const { data } = await this.youtube.playlists.list({
            part: ["id", "snippet"],
            mine: true,
            maxResults: 100
        })
        log(data, "Playlist list")
        const playlists = data.items && data.items || []
        return playlists.filter((playlist) => playlistNames.find((name) => playlist.snippet?.title === name))
            .map((playlist) => { return { id: playlist.id || "", name: playlist.snippet?.title || "" } })
    }

    async getPlaylistsId(playlistNames: string[], upsert = false): Promise<string[]> {
        const playlists = await this.getPlaylists(playlistNames)
        if (upsert) {
            for (const name of playlistNames) {
                let playlist = playlists.find(p => p.name)
                if (!playlist) {
                    playlist = await this.upsertPlaylist(name)
                    playlists.push(playlist)
                }
            }
        }
        return playlists.map((playlist) => playlist.id)
    }

    async insertVideoInPlaylist(playlistId: string, videoId: string) {
        await this.youtube.playlistItems.insert({
            part: ["id", "snippet"],
            requestBody: {
                id: playlistId,
                snippet: {
                    playlistId,
                    resourceId: {
                        kind: "youtube#video",
                        videoId
                    }
                }
            }
        })
    }

    async isVideoInPlaylist(playlistId: string, videoId: string) {
        const data = await this.youtube.playlistItems.list({
            part: ["id"],
            playlistId,
            videoId
        })
        return data && data.data && data.data.items && data.data.items.length > 0
    }

    async addVideoInPlaylist(playlistId: string, videoId: string) {
        if (!await this.isVideoInPlaylist(playlistId, videoId)) {
            await this.insertVideoInPlaylist(playlistId, videoId)
        }
    }

    async upsertPlaylist(playlistName: string) {
        const playlists = await this.getPlaylists([playlistName])
        let playlist = playlists && playlists[0]
        if (!playlist) {
            const newPlaylist = await this.youtube.playlists.insert({
                part: ["snippet"],
                requestBody: {
                    snippet: {
                        title: playlistName
                    }
                }
            })
            playlist = { id: newPlaylist.data.id || "", name: playlistName }
        }
        return playlist
    }

    computeSetCurrentStream(css: CurrentStreamSettings) {
        css._titleOriginal = css.title
        css._descriptionOrignal = css.description

        if (css.subject) {
            const separator = css.subjectSeparator || " - "

            if (css.subjectBeforeTitle) {
                css.title = `${css.subject}${separator}${css.title}`
            }

            if (css.subjectAfterTitle) {
                css.title = `${css.title}${separator}${css.subject}`
            }

            if (css.subjectAddToTags) {
                if (!css.tags) {
                    css.tags = []
                }
                css.tags.push(css.subject?.toLowerCase())
            }
        }

        if (css.tagsAddDescription && css.tags) {
            css.description += "\n"
            if (css.tagsDescriptionNewLine) {
                css.description += "\n"
            }

            const hash = css.tagsDescriptionWithHashTag ? "#" : ""
            const whiteSpaceReplacement = css.tagsDescriptionWhiteSpace ? css.tagsDescriptionWhiteSpace : ""
            for (const tag of css.tags) {
                const cleanTag = tag.replace(/ /g, whiteSpaceReplacement)
                css.description += ` ${hash}${cleanTag}`
            }
        }
    }

    async setCurrentStream(infoStream: { liveBroadcast: youtube_v3.Schema$LiveBroadcast, video: youtube_v3.Schema$Video }, css: CurrentStreamSettings) {
        log(css, "Raw current stream parameters to set")

        const categoryId = css.category ? await this.getCategoryId(css.category) : undefined
        const playlistsId = css.playlists ? await this.getPlaylistsId(css.playlists, true) : undefined

        css.category = categoryId
        css.playlists = playlistsId

        this.computeSetCurrentStream(css)

        await this.updateVideo(infoStream.video, css)

        if (css.playlists && infoStream.video.id) {
            for (const playlistId of css.playlists) {
                await this.addVideoInPlaylist(playlistId, infoStream.video.id)
            }
        }

    }

    async updateDescription(video: youtube_v3.Schema$Video, css: CurrentStreamSettings) {
        css.description = css.description || video.snippet?.description || ""
        const timestampsTitle = css.timestampsTitle || "Timestamps :\n"

        if (css.timestamps && !new RegExp(timestampsTitle, "i").test(css.description)) {
            const firstLine = css.timestamps.split("\n")[0]
            css.description += "\n\n"
            if (/[0-9]+/g.test(firstLine)) {
                css.description += timestampsTitle
            }
            css.description += css.timestamps
            await this.updateVideo(video, css)
        }
    }

    async setCurrentThumbnail(video: youtube_v3.Schema$Video, image: unknown) {
        const params: youtube_v3.Params$Resource$Thumbnails$Set = {
            videoId: video.id || "",
            media: {
                body: image
            }
        }
        await this.youtube.thumbnails.set(params)
    }

    fetchFile(pathObj: string, allowedType: string[], isDir = false) {
        if (isDir) {
            const dirContent = readdirSync(pathObj)
            const lastFile = dirContent
                .filter((nameFile) => allowedType.includes(nameFile.toLocaleLowerCase().split(".").slice(-1)[0]))
                .sort((a, b) => {
                    const a2 = statSync(join(pathObj, a)).mtimeMs
                    const b2 = statSync(join(pathObj, b)).mtimeMs
                    return a2 < b2 ? 1 : (a2 > b2 ? -1 : 0)
                })[0]
            pathObj = join(pathObj, lastFile)
        }
        log({ path: pathObj }, "File path")
        return readFileSync(pathObj)
    }

    fetchImage(pathObj: string, isDir = false) {
        return this.fetchFile(pathObj, ["png", "jpeg", "jpg"], isDir)
    }

    fetchVideo(pathObj: string, isDir = false) {
        return this.fetchFile(pathObj, ["mkv", "mp4", "mov", "avi"], isDir)
    }

    async setLiveStreamInfo(livebroadcast: youtube_v3.Schema$LiveBroadcast, title?: string, description?: string) {
        const changed = !!(title || description)
        if (changed) {
            const params: youtube_v3.Params$Resource$Livebroadcasts$Update = {
                part: ["id", "snippet", "status"],
                requestBody: {
                    id: livebroadcast.id,
                    snippet: {
                        scheduledStartTime: livebroadcast.snippet?.scheduledStartTime
                    },
                    status: {
                        privacyStatus: livebroadcast.status?.privacyStatus,
                    }
                }
            }
            if (title) {
                params.requestBody!.snippet!.title = title
            }
            if (description) {
                params.requestBody!.snippet!.description = description
            }
            if (livebroadcast.id) {
                const res = await this.youtube.liveBroadcasts.update(params)
                console.log("Live broadcast updated:", JSON.stringify(res.data))
            } else {
                console.log("No live broadcast found")
            }
        } else {
            console.log("No data to change in title or description")
        }
    }
}
