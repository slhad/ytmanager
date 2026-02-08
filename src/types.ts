
export type ParameterType = "string" | "integer" | "boolean" | "stringList" | "choice"

export interface ParameterDefinition {
    name: string
    type: ParameterType
    description: string
    required?: boolean
    defaultValue?: any
    alternatives?: string[] // For choice
    environmentVariable?: string
    argumentName?: string // For CLI help
}

export interface ActionDefinition {
    name: string
    summary: string
    description: string
    parameters?: ParameterDefinition[]
    // The handler receives a key-value map of parameters
    handler: (params: Record<string, any>, context: any) => Promise<any>
    api?: {
        method?: "GET" | "POST" | "PUT" | "DELETE"
        path?: string
    }
}
