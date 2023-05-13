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

const getLiveBroadcast = async () => {
    const { data } = await youtube.liveBroadcasts.list({
        part: ["id", "snippet", "status", "contentDetails"],
        mine: true,
        maxResults: 1,
        broadcastType: 'all'
    });
    log(data, "Livebroadcast list")
    return data.items && data.items[0] || {};
}

const getVideo = async (videoId: string) => {
    const { data } = await youtube.videos.list({
        part: ["id", "snippet", "statistics"],
        id: [videoId]
    });
    log(data, "Video list")
    return data.items && data.items[0] || {};
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



const run = async () => {
    if (!tokens || !(code && code !== "")) {
        const app = express()
        const port = extractPort(redirect_uris[0])
        const pathCallback = extractPathCallback(redirect_uris[0])

        const listener = app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
        });

        app.get(pathCallback, async (req, res) => {
            const code = req.query.code as string;
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            res.send('OAuth2Client authorized successfully!');
            saveConfig({ code, tokens })
            console.log("Code from google auth saved")
            listener.close()
        })
        console.log(`Please open this url to authorize the connection with your google application from creds.json file : ${authorizeUrl}`)
    } else {
        setCreds(tokens)

        verbose = verboseFlag.value
        pretty = prettyFlag.value


        const liveBroadcast = await getLiveBroadcast()
        let video
        if (liveBroadcast.id) {
            video = await getVideo(liveBroadcast.id)
        }

        switch (clp.selectedAction?.actionName) {
            case infoAction.actionName:
                info({ liveBroadcast, video })
                break
            case setTitleAction.actionName:
                setTitleStream(liveBroadcast, setTitleAction.getStringParameter("--title").value || "")
                break
            case playlistIdAction.actionName:
                const playlists = await getPlaylistsId([playlistIdAction.getStringParameter("--playlist").value || ""])
                info((playlists || [])[0]?.id)
                break
            case playlistsIdAction.actionName:
                info(await getPlaylistsId(playlistIdAction.getStringListParameter("--playlist").values.slice() || []))
                break
            default:
                info("No action given")
        }
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
clp.execute().then(run)