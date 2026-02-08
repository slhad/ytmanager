import { describe, it, expect } from "@jest/globals"

// Since index.ts has side effects (reads config files on import), we need to test
// the pure functions by extracting their logic. For now, we'll test the logic
// that can be extracted or reimplemented for testing.

// Test helper functions that mirror the logic in index.ts
// These are re-implementations of the pure functions for testing purposes

/**
 * Extracts the path from a redirect URI
 * Mirrors: extractPathCallback in index.ts
 */
const extractPathCallback = (redirectURI: string): string => {
    const url = new URL(redirectURI)
    const path = url.pathname
    return path
}

/**
 * Extracts the port from a redirect URI, defaulting to 80 if not specified
 * Mirrors: extractPort in index.ts
 */
const extractPort = (redirectURI: string): number => {
    const url = new URL(redirectURI)
    const port = url.port
    return port !== "" ? parseInt(port) : 80
}

/**
 * Settings type for stream configuration
 */
type CurrentStreamSettings = {
    language?: string
    languageSub?: string
    playlists?: string[]
    tags?: string[]
    category?: string
    subject?: string
    title?: string
    _titleOriginal?: string
    description?: string
    _descriptionOrignal?: string
    subjectBeforeTitle?: boolean
    subjectAfterTitle?: boolean
    subjectSeparator?: string
    subjectAddToTags?: boolean
    tagsAddDescription?: boolean
    tagsDescriptionWithHashTag?: boolean
    tagsDescriptionNewLine?: boolean
    tagsDescriptionWhiteSpace?: string
    timestampsTitle?: string
    timestamps?: string
}

/**
 * Computes stream settings by modifying title/description based on subject and tags
 * Mirrors: computeSetCurrentStream in index.ts
 */
const computeSetCurrentStream = (css: CurrentStreamSettings): void => {
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

// Unit tests for extractPathCallback function
describe("extractPathCallback", () => {
    it("should extract path from localhost URL with path", () => {
        const result = extractPathCallback("http://localhost:3000/callback")
        expect(result).toBe("/callback")
    })

    it("should extract path from localhost URL with nested path", () => {
        const result = extractPathCallback("http://localhost:8080/oauth/callback")
        expect(result).toBe("/oauth/callback")
    })

    it("should return root path when no path specified", () => {
        const result = extractPathCallback("http://localhost:3000")
        expect(result).toBe("/")
    })

    it("should handle HTTPS URLs", () => {
        const result = extractPathCallback("https://example.com:443/auth/google/callback")
        expect(result).toBe("/auth/google/callback")
    })

    it("should handle URLs without explicit port", () => {
        const result = extractPathCallback("https://example.com/callback")
        expect(result).toBe("/callback")
    })

    it("should handle trailing slashes", () => {
        const result = extractPathCallback("http://localhost:3000/callback/")
        expect(result).toBe("/callback/")
    })
})

// Unit tests for extractPort function
describe("extractPort", () => {
    it("should extract explicit port from URL", () => {
        const result = extractPort("http://localhost:3000/callback")
        expect(result).toBe(3000)
    })

    it("should extract port 8080", () => {
        const result = extractPort("http://localhost:8080/oauth")
        expect(result).toBe(8080)
    })

    it("should return 80 when no port is specified for HTTP", () => {
        const result = extractPort("http://localhost/callback")
        expect(result).toBe(80)
    })

    it("should return 80 when no port is specified for HTTPS", () => {
        // Note: The original function returns 80 regardless of protocol
        const result = extractPort("https://example.com/callback")
        expect(result).toBe(80)
    })

    it("should handle explicit port 443 when specified", () => {
        // Note: JavaScript URL parser returns empty string for default HTTPS port 443
        // Our function returns 80 when port is empty (matching original implementation)
        // To test port 443, we use HTTP scheme where 443 is not the default
        const result = extractPort("http://example.com:443/callback")
        expect(result).toBe(443)
    })

    it("should handle high port numbers", () => {
        const result = extractPort("http://localhost:65535/callback")
        expect(result).toBe(65535)
    })

    it("should handle port 80 explicitly", () => {
        const result = extractPort("http://localhost:80/callback")
        expect(result).toBe(80)
    })
})

// Unit tests for computeSetCurrentStream function
describe("computeSetCurrentStream", () => {
    describe("original values preservation", () => {
        it("should preserve original title and description", () => {
            const css: CurrentStreamSettings = {
                title: "Original Title",
                description: "Original Description"
            }

            computeSetCurrentStream(css)

            expect(css._titleOriginal).toBe("Original Title")
            expect(css._descriptionOrignal).toBe("Original Description")
        })

        it("should preserve undefined values", () => {
            const css: CurrentStreamSettings = {}

            computeSetCurrentStream(css)

            expect(css._titleOriginal).toBeUndefined()
            expect(css._descriptionOrignal).toBeUndefined()
        })
    })

    describe("subject handling", () => {
        it("should prepend subject before title with default separator", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "Gaming",
                subjectBeforeTitle: true
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("Gaming - My Stream")
        })

        it("should append subject after title with default separator", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "Gaming",
                subjectAfterTitle: true
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("My Stream - Gaming")
        })

        it("should use custom separator when provided", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "Gaming",
                subjectBeforeTitle: true,
                subjectSeparator: " | "
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("Gaming | My Stream")
        })

        it("should handle both before and after subject flags", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "Gaming",
                subjectBeforeTitle: true,
                subjectAfterTitle: true
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("Gaming - My Stream - Gaming")
        })

        it("should add subject to tags when subjectAddToTags is true", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "Gaming",
                subjectAddToTags: true,
                tags: ["tag1"]
            }

            computeSetCurrentStream(css)

            expect(css.tags).toContain("gaming") // lowercase
            expect(css.tags).toEqual(["tag1", "gaming"])
        })

        it("should create tags array if not exists when adding subject", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subject: "GAMING",
                subjectAddToTags: true
            }

            computeSetCurrentStream(css)

            expect(css.tags).toEqual(["gaming"])
        })

        it("should not modify title when no subject is provided", () => {
            const css: CurrentStreamSettings = {
                title: "My Stream",
                subjectBeforeTitle: true,
                subjectAfterTitle: true
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("My Stream")
        })
    })

    describe("tags in description", () => {
        it("should add tags to description with newline", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: ["gaming", "live"],
                tagsAddDescription: true
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description\n gaming live")
        })

        it("should add extra newline when tagsDescriptionNewLine is true", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: ["gaming"],
                tagsAddDescription: true,
                tagsDescriptionNewLine: true
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description\n\n gaming")
        })

        it("should add hashtags when tagsDescriptionWithHashTag is true", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: ["gaming", "live"],
                tagsAddDescription: true,
                tagsDescriptionWithHashTag: true
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description\n #gaming #live")
        })

        it("should replace spaces in tags with custom whitespace replacement", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: ["game dev", "live stream"],
                tagsAddDescription: true,
                tagsDescriptionWhiteSpace: "_"
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description\n game_dev live_stream")
        })

        it("should combine all tag description options", () => {
            const css: CurrentStreamSettings = {
                description: "My stream",
                tags: ["game dev", "live"],
                tagsAddDescription: true,
                tagsDescriptionNewLine: true,
                tagsDescriptionWithHashTag: true,
                tagsDescriptionWhiteSpace: ""
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("My stream\n\n #gamedev #live")
        })

        it("should not modify description when tagsAddDescription is false", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: ["gaming", "live"],
                tagsAddDescription: false
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description")
        })

        it("should not modify description when tags are undefined", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tagsAddDescription: true
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description")
        })

        it("should handle empty tags array", () => {
            const css: CurrentStreamSettings = {
                description: "Stream description",
                tags: [],
                tagsAddDescription: true
            }

            computeSetCurrentStream(css)

            expect(css.description).toBe("Stream description\n")
        })
    })

    describe("combined subject and tags", () => {
        it("should handle subject added to tags and then tags to description", () => {
            const css: CurrentStreamSettings = {
                title: "Epic Stream",
                description: "Welcome to my stream",
                subject: "Minecraft",
                subjectBeforeTitle: true,
                subjectAddToTags: true,
                tags: ["gaming"],
                tagsAddDescription: true,
                tagsDescriptionWithHashTag: true
            }

            computeSetCurrentStream(css)

            expect(css.title).toBe("Minecraft - Epic Stream")
            expect(css.tags).toEqual(["gaming", "minecraft"])
            expect(css.description).toBe("Welcome to my stream\n #gaming #minecraft")
        })
    })
})
