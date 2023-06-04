import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

import { DynamicCommandLineAction, DynamicCommandLineParser } from "@rushstack/ts-command-line";
import { commandLineParser } from "./cmd";

const CONFIG_FILE = "./config.json"
const CREDS_FILE = "./creds.json"

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
    description?: string,
    subjectBeforeTitle?: boolean,
    subjectAfterTitle?: boolean,
    subjectSeparator?: string,
    subjectAddToTags?: boolean,
    tagsAddDescription?: boolean,
    tagsDescriptionWithHashTag?: boolean,
    tagsDescriptionNewLine?: boolean
}

const updateVideo = async (video: youtube_v3.Schema$Video, parameters: CurrentStreamSettings) => {
    const update: youtube_v3.Params$Resource$Videos$Update = {
        part: ["id"],
        requestBody: {
            id: video.id
        }
    }

    if (parameters) {
        if (parameters.category || parameters.language || parameters.playlists || parameters.tags) {

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
            }

            if (parameters.tags) {
                update.requestBody.snippet.tags = parameters.tags
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
        part: ["id", "snippet", "statistics"],
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

const getPlaylistsId = async (playlistNames: string[]): Promise<string[]> => {
    const playlists = await getPlaylists(playlistNames)
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

const setCurrentStream = async (stream: InfoStream, css: CurrentStreamSettings) => {
    log(css, "Raw current stream parameters to set")

    const categoryId = css.category ? await getCategoryId(css.category) : undefined
    const playlistsId = css.playlists ? await getPlaylistsId(css.playlists) : undefined

    css.category = categoryId
    css.playlists = playlistsId

    await updateVideo(stream.video, css)

    if (css.playlists && stream.video.id) {
        for (const playlistId of css.playlists) {
            await addVideoInPlaylist(playlistId, stream.video.id)
        }
    }

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
                language: setCurrentStreamAction.getStringParameter("--language").value,
                languageSub: setCurrentStreamAction.getStringParameter("--language-sub").value,
                playlists: setCurrentStreamAction.getStringListParameter("--playlist").values.slice(),
                tags: setCurrentStreamAction.getStringListParameter("--tag").values.slice(),
                category: setCurrentStreamAction.getStringParameter("--category").value,
                subject: setCurrentStreamAction.getStringParameter("--subject").value,
                subjectAddToTags: setCurrentStreamAction.getFlagParameter("subjectAddToTags").value,
                tagsAddDescription: setCurrentStreamAction.getFlagParameter("tagsAddDescription").value,
                tagsDescriptionWithHashTag: setCurrentStreamAction.getFlagParameter("tagsDescriptionWithHashtag").value,
                tagsDescriptionNewLine: setCurrentStreamAction.getFlagParameter("tagsDescriptionNewLine").value
            }
            setCurrentStream(infoStream, params)
            break;
        default:
            info("No action given");
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


const { cmd, flags, actions } = commandLineParser
const { prettyFlag, verboseFlag } = flags
const { infoAction, playlistIdAction, playlistsAction, setCurrentStreamAction, setTitleAction } = actions
cmd.execute().then(run)