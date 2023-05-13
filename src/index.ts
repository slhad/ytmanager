import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

const CONFIG_FILE = "./config.json"
const CREDS_FILE = "./creds.json"

type Config = { code: string; tokens: Credentials }

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

const setTitleStream = async (liveBroadcast: youtube_v3.Schema$LiveBroadcast) => {
    if (liveBroadcast) {
        const update = {
            part: ["id", "snippet", "status", "contentDetails"],
            requestBody: {
                id: liveBroadcast.id,
                snippet: {
                    title: 'super stream',
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
        console.log(JSON.stringify(update, undefined, 3))
        youtube.liveBroadcasts.update(update);
    }
}

const getLivestream = async () => {
    const { data } = await youtube.liveBroadcasts.list({
        part: ["id", "snippet", "status", "contentDetails"],
        mine: true,
        maxResults: 1,
        broadcastType: 'all'
    });
    console.log(JSON.stringify(data, undefined, 3))
    return data.items && data.items[0] || {};
}

const getVideo = async (videoId: string) => {
    const { data } = await youtube.videos.list({
        part: ["id", "snippet", "statistics"],
        id: [videoId]
    });
    console.log(JSON.stringify(data, undefined, 3))
    return data.items && data.items[0] || {};
}

const getPlaylistId = async (playlistName: string) => {
    const { data } = await youtube.playlists.list({
        part: ["id"],
        mine: true,
        maxResults: 1
    });
    console.log(JSON.stringify(data, undefined, 3))
    return data.items && data.items[0].id || "";
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
        const liveStream = await getLivestream()
        let video
        if (liveStream.id){
            video = await getVideo(liveStream.id)
        }

        await setTitleStream(liveStream)
    }
}


run()