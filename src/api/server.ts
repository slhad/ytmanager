
import express, { Express, Request, Response, NextFunction } from "express"
import { actions } from "../actions"
import { Context } from "../context"
import { ParameterDefinition } from "../types"

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

export const createServer = (ctx: Context): Express => {
    const app = express()
    app.use(express.json())

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
                                value = [value]
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
        console.log(`Server running at http://${host}:${port}`)
    })
}
