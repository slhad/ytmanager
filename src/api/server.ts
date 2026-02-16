
import express, { Express, Request, Response, NextFunction } from "express"
import { actions } from "../actions"
import { Context } from "../context"
import { ParameterDefinition } from "../types"

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

// Safely stringify objects for logging with truncation and binary detection
const safeStringify = (obj: any, maxLen = 2048): string => {
    try {
        if (obj === undefined) return ""
        if (Buffer.isBuffer(obj)) return `<Buffer length=${obj.length}>`
        const s = typeof obj === "string" ? obj : JSON.stringify(obj)
        if (!s) return ""
        return s.length > maxLen ? s.slice(0, maxLen) + "..." : s
    } catch (e) {
        return "[unserializable]"
    }
}

export const createServer = (ctx: Context): Express => {
    const app = express()
    app.use(express.json())

    // Verbose request logging middleware — logs method, path, status and latency
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (!ctx.verbose) return next()

        const start = Date.now()
        const contentType = (req.headers["content-type"] || "").toString()
        const isBinary = contentType.includes("multipart/form-data") || contentType.startsWith("image/") || contentType.startsWith("video/")

        res.on("finish", () => {
            const duration = Date.now() - start
            const queryStr = req.query && Object.keys(req.query).length ? ` query=${safeStringify(req.query, 512)}` : ""
            const bodyStr = isBinary ? " body=<skipped-binary>" : (req.body ? ` body=${safeStringify(req.body, 2048)}` : "")
            console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${queryStr}${bodyStr}`)
        })

        next()
    })

    // Inform at startup if verbose logging is enabled
    if (ctx.verbose) {
        console.log("[API] Verbose request logging ENABLED")
    }

    // Health check
    app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() })
    })

    // Endpoint discovery
    app.get("/api/endpoints", (req, res) => {
        res.json({
            usage: {
                methodOverride: "For actions requiring POST/PUT/DELETE, you can use GET with ?_method=METHOD query parameter (e.g., ?_method=POST)."
            },
            endpoints: [
                { method: "GET", path: "/health", description: "Health check" },
                { method: "GET", path: "/api/endpoints", description: "List all endpoints" },
                ...actions.map(a => ({
                    name: a.name,
                    description: a.description,
                    method: a.api?.method,
                    path: a.api?.path ? `/api${a.api.path}` : undefined,
                    parameters: a.parameters
                })).filter(e => e.path)
            ]
        })
    })

    actions.forEach(action => {
        if (!action.api || !action.api.path) return

        const originalMethod = (action.api.method || "GET").toLowerCase() as "get" | "post" | "put" | "delete"
        const path = `/api${action.api.path}`

        const handler = asyncHandler(async (req, res) => {
            const params: Record<string, any> = {}
            const isOverride = req.method === "GET" && req.query._method === originalMethod.toUpperCase()
            const effectiveMethod = isOverride ? originalMethod : (req.method.toLowerCase() as "get" | "post" | "put" | "delete")

            // Extract parameters
            if (action.parameters) {
                action.parameters.forEach(param => {
                    let value = undefined

                    // If it's a real GET or a fake GET (override), look in query
                    if (req.method === "GET") {
                        value = req.query[param.name]

                        // Handle conversion for query params
                        if (value !== undefined) {
                            if (param.type === "integer") value = parseInt(value as string)
                            if (param.type === "boolean") value = value === "true"
                            // Handle list?
                            if (param.type === "stringList" && !Array.isArray(value)) {
                                value = (value as string).split(",").map(v => v.trim())
                            }
                        }
                    } else {
                        // Body parameters for real POST/PUT/DELETE
                        // Try both exact name and camelCase
                        value = req.body[param.name]
                        if (value === undefined) {
                            // simple camelCase conversion
                            const camelName = param.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
                            value = req.body[camelName]
                        }
                    }

                    if (value !== undefined) {
                        params[param.name] = value
                    } else if (param.defaultValue !== undefined) {
                        params[param.name] = param.defaultValue
                    }
                })
            }

            try {
                const result = await action.handler(params, ctx)
                res.json(result || { success: true })
            } catch (error: any) {
                console.error(`Error in action ${action.name}:`, error)
                res.status(500).json({ success: false, error: error.message })
            }
        })

        // Register the primary route
        app[originalMethod](path, handler)

        // If the primary route is not GET, also register a GET route for overrides
        if (originalMethod !== "get") {
            app.get(path, (req, res, next) => {
                if (req.query._method === originalMethod.toUpperCase()) {
                    return handler(req, res, next)
                }
                next()
            })
        }
    })

    return app
}

export const startServer = (port: number, host: string, ctx: Context): void => {
    const app = createServer(ctx)
    app.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port} (verbose=${ctx.verbose})`)
    })
}
