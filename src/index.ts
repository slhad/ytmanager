import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

import { DynamicCommandLineAction, DynamicCommandLineParser } from "@rushstack/ts-command-line";

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
    category?: string
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
                    title: video.snippet?.title
                }
            }

            if (parameters.language) {
                defaultLanguage: parameters.language
            }


            if (parameters.category) {
                update.requestBody.snippet.categoryId = video.snippet?.categoryId//parameters.category
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

const getCategoryId = async (categoryName: string) => {
    const resp = await youtube.videoCategories.list({})
    return resp.data && resp.data.items && resp.data.items.length ? resp.data.items[0].id || undefined : undefined
}

const getPlaylists = async () => {
    const { data } = await youtube.playlists.list({
        part: ["id", "snippet"],
        mine: true,
        maxResults: 100
    });
    log(data, "Playlist list")
    return data.items && data.items || [];
}

const getPlaylistsId = async (playlistNames: string[]): Promise<{ id: string, name: string }[]> => {
    const playlists = await getPlaylists()
    return playlists
        .filter((playlist) => playlistNames.find((name) => playlist.snippet?.title === name))
        .map((playlist) => { return { id: playlist.id || "", name: playlist.snippet?.title || "" } })
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
    switch (clp.selectedAction?.actionName) {
        case playlistIdAction.actionName:
            const playlists = await getPlaylistsId([playlistIdAction.getStringParameter("--playlist").value || ""])
            info((playlists || [])[0]?.id);
            return true
        case playlistsIdAction.actionName:
            info(await getPlaylistsId(playlistIdAction.getStringListParameter("--playlist").values.slice() || []))
            return true
        default:
            return false
    }
}

type InfoStream = {
    liveBroadcast: youtube_v3.Schema$LiveBroadcast
    video: youtube_v3.Schema$Video
}

const setCurrentStream = async (stream: InfoStream, css: CurrentStreamSettings) => {
    log(css, "Raw current stream parameters to set")

    const categoryId = css.category ? await getCategoryId(css.category) : undefined
    const playlistsId = css.playlists ? await getPlaylistsId(css.playlists) : undefined

    css.category = categoryId
    css.playlists = playlistsId?.map

    await updateVideo(stream.video, css)
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

    switch (clp.selectedAction?.actionName) {
        case infoAction.actionName:
            info(infoStream);
            break;
        case setTitleAction.actionName:
            setTitleStream(liveBroadcast, setTitleAction.getStringParameter("--title").value || "")
            break;
        case playlistIdAction.actionName:
            const playlists = await getPlaylistsId([playlistIdAction.getStringParameter("--playlist").value || ""])
            info((playlists || [])[0]?.id);
            break;
        case playlistsIdAction.actionName:
            info(await getPlaylistsId(playlistIdAction.getStringListParameter("--playlist").values.slice() || []))
            break;
        case setCurrentStreamAction.actionName:
            const params: CurrentStreamSettings = {
                language: setCurrentStreamAction.getStringParameter("--language").value,
                languageSub: setCurrentStreamAction.getStringParameter("--language-sub").value,
                playlists: setCurrentStreamAction.getStringListParameter("--playlist").values.slice(),
                tags: setCurrentStreamAction.getStringListParameter("--tag").values.slice(),
                category: setCurrentStreamAction.getStringParameter("--category").value
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


import { name, description } from "../package.json"
const clp = new DynamicCommandLineParser({
    toolFilename: name,
    toolDescription: description
})

const verboseFlag = clp.defineFlagParameter({
    parameterLongName: '--verbose',
    parameterShortName: '-v',
    description: 'Verbose logging',
})
const prettyFlag = clp.defineIntegerParameter({
    parameterLongName: '--pretty',
    parameterShortName: '-p',
    argumentName: "NUMBER",
    description: 'Pretty print logging',
})

const infoAction = new DynamicCommandLineAction({
    actionName: "info",
    summary: "Get current stream info",
    documentation: "Will return broadcast and video info"
})
clp.addAction(infoAction)

const setTitleAction = new DynamicCommandLineAction({
    actionName: "set-title",
    summary: "Set stream title",
    documentation: "Set your stream title"
})

setTitleAction.defineStringParameter({
    parameterLongName: "--title",
    argumentName: "TITLE",
    description: "Title to set"
})

const playlistsIdAction = new DynamicCommandLineAction({
    actionName: "get-playlists",
    summary: "get playlists id",
    documentation: "Get playlists id by name"
})

playlistsIdAction.defineStringListParameter({
    parameterLongName: "--playlist",
    argumentName: "PLAYLIST",
    description: "Playlist name"
})
clp.addAction(playlistsIdAction)

const playlistIdAction = new DynamicCommandLineAction({
    actionName: "get-playlist",
    summary: "get playlist id",
    documentation: "Get playlist id by name"
})

playlistIdAction.defineStringParameter({
    parameterLongName: "--playlist",
    argumentName: "PLAYLIST",
    description: "Playlist name"
})
clp.addAction(playlistIdAction)

const setCurrentStreamAction = new DynamicCommandLineAction({
    actionName: "set-current-stream",
    summary: "set current stream",
    documentation: "Set parameters to current stream"
})

setCurrentStreamAction.defineStringListParameter({
    parameterLongName: "--playlist",
    argumentName: "PLAYLIST",
    description: "Playlist name",
    environmentVariable: "PLAYLIST"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--language",
    argumentName: "LANG",
    description: "Language name",
    environmentVariable: "LG"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--language-sub",
    argumentName: "LANGSUB",
    description: "Language subtitle name",
    environmentVariable: "LG"
})
setCurrentStreamAction.defineStringListParameter({
    parameterLongName: "--tag",
    argumentName: "TAG",
    description: "Tag",
    environmentVariable: "TAG"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--category",
    argumentName: "CATEGORY",
    description: "Category name",
    environmentVariable: "CATEGORY"
})
clp.addAction(setCurrentStreamAction)

clp.execute().then(run)