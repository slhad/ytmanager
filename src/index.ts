#!/usr/bin/env node

import { buildParser } from "./cmd"
import { askForAuth, getCode, getTokens, oAuth2Client, setCreds } from "./auth"
import { Context } from "./context"
import { YouTubeService } from "./service"
import { StreamLibrary } from "./persistence"
import { actions } from "./actions"

const { parser, flags, actionMap } = buildParser()

const log = (obj: unknown, verbose: boolean, pretty?: number, msg?: string) => {
    if (verbose) {
        const data = JSON.stringify(obj, undefined, pretty)
        const prefix = msg ? `${msg} : ` : ""
        console.log(`${prefix}${data}`)
    }
}

const info = (obj: unknown, pretty?: number) => {
    console.log(JSON.stringify(obj, undefined, pretty))
}

const run = async () => {
    try {
        await parser.execute(process.argv.slice(2))
    } catch (error: any) {
        console.error(error.message)
        process.exit(1)
    }

    if (!parser.selectedAction) {
        // If no action selected, help text is usually shown by parser.execute or thrown
        return
    }

    const tokens = getTokens()
    const code = getCode()

    if (!tokens || !(code && code !== "")) {
        askForAuth()
        return
    }

    setCreds(tokens)
    const verbose = flags.verboseFlag.value
    const pretty = flags.prettyFlag.value

    const service = new YouTubeService(oAuth2Client)

    let library: StreamLibrary | undefined = undefined
    if (flags.historyFlag.value) {
        library = StreamLibrary.load()
    }

    const context: Context = {
        service,
        library,
        verbose,
        pretty
    }

    const actionName = parser.selectedAction.actionName
    const actionDef = actions.find(a => a.name === actionName)

    if (actionDef && actionMap.has(actionName)) {
        const { params: paramParsers } = actionMap.get(actionName)!
        const params: Record<string, any> = {}

        // Extract parameters from CLI parsers
        for (const [key, parser] of Object.entries(paramParsers)) {
            // Check if it's a list param first
            const parserAny = parser as any
            if (parserAny.values && Array.isArray(parserAny.values) && parserAny.values.length > 0) {
                params[key] = parserAny.values
            } else if (parserAny.value !== undefined) {
                params[key] = parserAny.value
            }
        }

        try {
            const result = await actionDef.handler(params, context)
            if (result !== undefined) {
                info(result, pretty)
            }
        } catch (error: any) {
            console.error(`Error executing action ${actionName}:`, error.message)
            process.exit(1)
        }
    } else {
        console.error(`Action definition not found for ${actionName}`)
    }
}

run().catch(console.error)
