import express from "express";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from 'path';
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import imageminPngquant from "imagemin-pngquant"

import { commandLineParser } from "./cmd";
const { cmd, flags, actions } = commandLineParser
const { prettyFlag, verboseFlag } = flags
const { infoAction, playlistIdAction, playlistsAction, setCurrentStreamAction, setTitleAction, setCurrentThumbnailAction } = actions

const CONFIG_FILE = "./config.json"
const CREDS_FILE = "./creds.json"

const YOUTUBE_THUMBNAIL_SIZE_LIMIT = 2097152

type Config = { code: string; tokens: Credentials }

let verbose = false
let pretty: number | undefined = undefined

const log = (obj: any, msg?: string) => {
    if (verbose) {
        const data = JSON.stringify(obj, undefined, pretty)
        const prefix = msg ? `${msg} : ` : ""
        console.log(`${prefix}${data}`)
    }
}

const info = (obj: any) => {
    console.log(JSON.stringify(obj, undefined, pretty))
}

const getYTConnectInfo = () => {
    const file = readFileSync(CREDS_FILE)
    const data: { installed: { client_id: string, client_secret: string, redirect_uris: string[] } } = JSON.parse(file.toString())
    return data && data.installed
}

const getConfig = () => {
    const file = readFileSync(CONFIG_FILE)
    const data: Config = JSON.parse(file.toString())
    return data
}


const extractPathCallback = (redirectURI: string) => {
    const url = new URL(redirectURI);
    const path = url.pathname;
    return path;
}

const extractPort = (redirectURI: string) => {
    const url = new URL(redirectURI);
    const port = url.port;
    return port != "" ? parseInt(port) : 80
}

const saveConfig = (config: Partial<Config>) => {
    const file = readFileSync(CONFIG_FILE)
    const data = file.toString()
    const parsed = JSON.parse(data)

    if (config && config.code) {
        parsed.code = config.code
    }

    if (config && config.tokens) {
        parsed.tokens = config.tokens
    }

    const dataToSave = JSON.stringify(parsed, undefined, 3)
    writeFileSync(CONFIG_FILE, dataToSave)
}

const { client_id, client_secret, redirect_uris } = getYTConnectInfo()
const { code, tokens } = getConfig()

const oAuth2Client = new OAuth2Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uris[0]
});

const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
    redirect_uri: redirect_uris[0]
});

const setCreds = async (tokens: Credentials) => {
    oAuth2Client.setCredentials(tokens);
}

const youtube = google.youtube({
    version: 'v3',
    auth: oAuth2Client
});

const setTitleStream = async (liveBroadcast: youtube_v3.Schema$LiveBroadcast, streamTitle: string) => {
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
        youtube.liveBroadcasts.update(update);
    }
}

type CurrentStreamSettings = {
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
    tagsDescriptionWhiteSpace?: string
}

const updateVideo = async (video: youtube_v3.Schema$Video, parameters: CurrentStreamSettings) => {
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
                update.requestBody.snippet = {
                    title: parameters.title || video.snippet?.title,
                    description: parameters.description || video.snippet?.description
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
            } else {
                update.requestBody.snippet.categoryId = video.snippet?.categoryId
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

            await youtube.videos.update(update)
        }
    }

}

const getLiveBroadcast = async () => {
    const { data } = await youtube.liveBroadcasts.list({
        part: ["id", "snippet", "status", "contentDetails"],
        mine: true,
        maxResults: 1,
        broadcastType: 'all'
    })
    log(data, "Livebroadcast list")
    return data.items && data.items[0] || {}
}

const getVideo = async (videoId: string) => {
    const { data } = await youtube.videos.list({
        part: ["id", "snippet", "statistics", "contentDetails"],
        id: [videoId]
    });
    log(data, "Video list")
    return data.items && data.items[0] || {};
}

const getCategoryId = async (categoryName: string, regionCode = "fr") => {
    const resp = await youtube.videoCategories.list({
        part: ["snippet"],
        regionCode
    })
    const data = resp.data && resp.data.items && resp.data.items.length ? resp.data.items : []
    return data.find(vc => vc.snippet?.title === categoryName)?.id || undefined
}

const getPlaylists = async (playlistNames: string[]): Promise<{ id: string, name: string }[]> => {
    const { data } = await youtube.playlists.list({
        part: ["id", "snippet"],
        mine: true,
        maxResults: 100
    });
    log(data, "Playlist list")
    const playlists = data.items && data.items || [];
    return playlists.filter((playlist) => playlistNames.find((name) => playlist.snippet?.title === name))
        .map((playlist) => { return { id: playlist.id || "", name: playlist.snippet?.title || "" } })
}

const getPlaylistsId = async (playlistNames: string[], upsert = false): Promise<string[]> => {
    const playlists = await getPlaylists(playlistNames)
    if (upsert) {
        for (const name of playlistNames) {
            let playlist = playlists.find(p => p.name)
            if (!playlist) {
                playlist = await upsertPlaylist(name)
                playlists.push(playlist)
            }
        }
    }
    return playlists.map((playlist) => playlist.id)
}

const askForAuth = () => {
    const app = express();
    const port = extractPort(redirect_uris[0])
    const pathCallback = extractPathCallback(redirect_uris[0])

    const listener = app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`)
    });

    app.get(pathCallback, async (req, res) => {
        const code = req.query.code as string
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        res.send('OAuth2Client authorized successfully!')
        saveConfig({ code, tokens })
        console.log("Code from google auth saved")
        listener.close()
    });
    console.log(`Please open this url to authorize the connection with your google application from creds.json file : ${authorizeUrl}`)
}

const fetchInfo = async (): Promise<boolean> => {
    switch (cmd.selectedAction?.actionName) {
        case playlistIdAction.actionName:
            const playlists = await getPlaylists([playlistIdAction.getStringParameter("--playlist").value || ""])
            info((playlists || [])[0]?.id);
            return true
        case playlistsAction.actionName:
            info(await getPlaylists(playlistIdAction.getStringListParameter("--playlist").values.slice() || []))
            return true
        default:
            return false
    }
}

type InfoStream = {
    liveBroadcast: youtube_v3.Schema$LiveBroadcast
    video: youtube_v3.Schema$Video
}

const insertVideoInPlaylist = async (playlistId: string, videoId: string) => {
    const data = await youtube.playlistItems.insert({
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

const isVideoInPlaylist = async (playlistId: string, videoId: string) => {
    const data = await youtube.playlistItems.list({
        part: ["id"],
        playlistId,
        videoId
    })
    return data && data.data && data.data.items && data.data.items.length > 0
}

const addVideoInPlaylist = async (playlistId: string, videoId: string) => {
    if (!await isVideoInPlaylist(playlistId, videoId)) {
        await insertVideoInPlaylist(playlistId, videoId)
    }
}

const upsertPlaylist = async (playlistName: string) => {
    const playlists = await getPlaylists([playlistName])
    let playlist = playlists && playlists[0]
    if (!playlist) {
        const newPlaylist = await youtube.playlists.insert({
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

const computeSetCurrentStream = (css: CurrentStreamSettings) => {
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

const setCurrentStream = async (stream: InfoStream, css: CurrentStreamSettings) => {
    log(css, "Raw current stream parameters to set")

    const categoryId = css.category ? await getCategoryId(css.category) : undefined
    const playlistsId = css.playlists ? await getPlaylistsId(css.playlists, true) : undefined

    css.category = categoryId
    css.playlists = playlistsId

    computeSetCurrentStream(css)

    await updateVideo(stream.video, css)

    if (css.playlists && stream.video.id) {
        for (const playlistId of css.playlists) {
            await addVideoInPlaylist(playlistId, stream.video.id)
        }
    }

}

const setCurrentThumbnail = async (video: youtube_v3.Schema$Video, image: any) => {
    const params: youtube_v3.Params$Resource$Thumbnails$Set = {
        videoId: video.id || "",
        media: {
            body: image
        }
    }
    await youtube.thumbnails.set(params)
}

const fetchFile = (pathObj: string, allowedType: string[], isDir = false) => {
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

const fetchImage = (pathObj: string, isDir = false) => {
    return fetchFile(pathObj, ["png", "jpeg", "jpg"], isDir)
}

const fetchVideo = (pathObj: string, isDir = false) => {
    return fetchFile(pathObj, ["mkv", "mp4", "mov", "avi"], isDir)
}


const act = async () => {
    if (await fetchInfo()) {
        // We did some action that did not require the current live broadcast
        return
    }

    const liveBroadcast = await getLiveBroadcast()
    let video: youtube_v3.Schema$Video;
    if (liveBroadcast.id) {
        video = await getVideo(liveBroadcast.id) || {}
    } else {
        video = undefined as any
    }

    const infoStream = { liveBroadcast, video }

    switch (cmd.selectedAction?.actionName) {
        case infoAction.actionName:
            info(infoStream);
            break;
        case setTitleAction.actionName:
            setTitleStream(liveBroadcast, setTitleAction.getStringParameter("--title").value || "")
            break;
        case playlistIdAction.actionName:
            const playlists = await getPlaylists([playlistIdAction.getStringParameter("--playlist").value || ""])
            info((playlists || [])[0]?.id);
            break;
        case playlistsAction.actionName:
            info(await getPlaylists(playlistIdAction.getStringListParameter("--playlist").values.slice() || []))
            break;
        case setCurrentStreamAction.actionName:
            const params: CurrentStreamSettings = {
                title: setCurrentStreamAction.getStringParameter("--title").value,
                description: setCurrentStreamAction.getStringParameter("--description").value,
                language: setCurrentStreamAction.getStringParameter("--language").value,
                languageSub: setCurrentStreamAction.getStringParameter("--language-sub").value,
                playlists: setCurrentStreamAction.getStringListParameter("--playlist").values.slice(),
                tags: setCurrentStreamAction.getStringListParameter("--tag").values.slice(),
                category: setCurrentStreamAction.getStringParameter("--category").value,
                subject: setCurrentStreamAction.getStringParameter("--subject").value,
                subjectAddToTags: setCurrentStreamAction.getFlagParameter("--subject-add-to-tags").value,
                subjectBeforeTitle: setCurrentStreamAction.getFlagParameter("--subject-before-title").value,
                subjectAfterTitle: setCurrentStreamAction.getFlagParameter("--subject-after-title").value,
                subjectSeparator: setCurrentStreamAction.getStringParameter("--subject-separator").value,
                tagsAddDescription: setCurrentStreamAction.getFlagParameter("--tags-add-description").value,
                tagsDescriptionWithHashTag: setCurrentStreamAction.getFlagParameter("--tags-description-with-hashtag").value,
                tagsDescriptionNewLine: setCurrentStreamAction.getFlagParameter("--tags-description-new-line").value,
                tagsDescriptionWhiteSpace: setCurrentStreamAction.getStringParameter("--tags-description-white-space").value
            }
            setCurrentStream(infoStream, params)
            break;
        case setCurrentThumbnailAction.actionName:
            const dir = setCurrentThumbnailAction.getStringParameter("--path-dir").value
            const file = setCurrentThumbnailAction.getStringParameter("--path-file").value
            const autoRecompress = setCurrentThumbnailAction.getFlagParameter("--auto-recompress-on-limit").value
            if (file || dir) {
                let dataImage = fetchImage(file || dir || "", !file && !!dir)

                if (dataImage.length > YOUTUBE_THUMBNAIL_SIZE_LIMIT) {
                    log({ imgSize: dataImage.length, youtubeThumbnailLimit: YOUTUBE_THUMBNAIL_SIZE_LIMIT }, "Thumbnail size is bigger than youtube api limit for thumbnail")
                    if (autoRecompress) {
                        dataImage = await imageminPngquant({
                            speed: 1
                        })(dataImage)
                        log({ imgSize: dataImage.length, youtubeThumbnailLimit: YOUTUBE_THUMBNAIL_SIZE_LIMIT }, "Recompressed thumbnail with slowest speed")
                    } else {
                        log({ autoRecompress }, "Auto recompression disabled")
                    }

                }

                await setCurrentThumbnail(video, dataImage)
            }
            break;
        default:
            console.log(cmd.renderHelpText());
    }
}


const run = async () => {
    if (!tokens || !(code && code !== "")) {
        askForAuth();
    } else {
        setCreds(tokens)
        verbose = verboseFlag.value
        pretty = prettyFlag.value
        await act()
    }
}

cmd.execute().then(run)