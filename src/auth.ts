
import { readFileSync, writeFileSync } from "fs"
import { google } from "googleapis"
import { OAuth2Client, Credentials } from "google-auth-library"
import express from "express"

const CONFIG_FILE = "./config.json"
const CREDS_FILE = "./creds.json"

type Config = { code: string, tokens: Credentials }

const getYTConnectInfo = () => {
    try {
        const file = readFileSync(CREDS_FILE)
        const data: { installed: { client_id: string, client_secret: string, redirect_uris: string[] } } = JSON.parse(file.toString())
        return data && data.installed
    } catch (e) {
        console.error("Error reading credentials file:", e)
        throw e
    }
}

const getConfig = () => {
    try {
        const file = readFileSync(CONFIG_FILE)
        const data: Config = JSON.parse(file.toString())
        return data
    } catch (e) {
        // If config doesn't exist, return empty
        return { code: "", tokens: {} as Credentials }
    }
}

const saveConfig = (config: Partial<Config>) => {
    let parsed: Config
    try {
        const file = readFileSync(CONFIG_FILE)
        parsed = JSON.parse(file.toString())
    } catch (e) {
        parsed = { code: "", tokens: {} }
    }

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
const config = getConfig()

export const oAuth2Client = new OAuth2Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uris[0]
})

export const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/youtube.force-ssl",
    redirect_uri: redirect_uris[0]
})

export const setCreds = (tokens: Credentials) => {
    oAuth2Client.setCredentials(tokens)
}

export const getTokens = () => config.tokens
export const getCode = () => config.code

export const extractPathCallback = (redirectURI: string) => {
    const url = new URL(redirectURI)
    const path = url.pathname
    return path
}

export const extractPort = (redirectURI: string) => {
    const url = new URL(redirectURI)
    const port = url.port
    return port != "" ? parseInt(port) : 80
}

export const askForAuth = () => {
    const app = express()
    const port = extractPort(redirect_uris[0])
    const pathCallback = extractPathCallback(redirect_uris[0])

    const listener = app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`)
    })

    app.get(pathCallback, async (req, res) => {
        const code = req.query.code as string
        const { tokens } = await oAuth2Client.getToken(code)
        oAuth2Client.setCredentials(tokens)
        res.send("OAuth2Client authorized successfully!")
        saveConfig({ code, tokens })
        console.log("Code from google auth saved")
        listener.close()
    })
    console.log(`Please open this url to authorize the connection with your google application from creds.json file : ${authorizeUrl}`)
}

export { redirect_uris }
