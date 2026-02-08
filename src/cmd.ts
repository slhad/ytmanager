
import { DynamicCommandLineAction, DynamicCommandLineParser, CommandLineFlagParameter, CommandLineIntegerParameter, CommandLineStringParameter, CommandLineStringListParameter, CommandLineChoiceParameter } from "@rushstack/ts-command-line"
import { name, description } from "../package.json"
import { actions } from "./actions"

export const buildParser = () => {
    const parser = new DynamicCommandLineParser({
        toolFilename: name,
        toolDescription: description
    })

    const historyFlag = parser.defineFlagParameter({
        parameterLongName: "--history",
        parameterShortName: "-H",
        description: "Save your stream and vertical info if queried/updated"
    })

    const verboseFlag = parser.defineFlagParameter({
        parameterLongName: "--verbose",
        parameterShortName: "-v",
        description: "Verbose logging",
    })

    const prettyFlag = parser.defineIntegerParameter({
        parameterLongName: "--pretty",
        parameterShortName: "-p",
        argumentName: "NUMBER",
        description: "Pretty print logging",
    })

    const actionMap = new Map<string, {
        action: DynamicCommandLineAction,
        params: Record<string, CommandLineFlagParameter | CommandLineIntegerParameter | CommandLineStringParameter | CommandLineStringListParameter | CommandLineChoiceParameter>
    }>()

    for (const actionDef of actions) {
        const action = new DynamicCommandLineAction({
            actionName: actionDef.name,
            summary: actionDef.summary,
            documentation: actionDef.description
        })

        const params: Record<string, any> = {}

        if (actionDef.parameters) {
            for (const paramDef of actionDef.parameters) {
                let param
                const options: any = {
                    parameterLongName: `--${paramDef.name}`,
                    description: paramDef.description,
                    environmentVariable: paramDef.environmentVariable,
                    required: paramDef.required
                }

                if (paramDef.argumentName) {
                    options.argumentName = paramDef.argumentName
                }

                switch (paramDef.type) {
                    case "string":
                        param = action.defineStringParameter(options)
                        break
                    case "integer":
                        param = action.defineIntegerParameter(options)
                        break
                    case "boolean":
                        // Flags don't have argumentName
                        delete options.argumentName
                        param = action.defineFlagParameter(options)
                        break
                    case "stringList":
                        param = action.defineStringListParameter(options)
                        break
                    case "choice":
                        options.alternatives = paramDef.alternatives || []
                        param = action.defineChoiceParameter(options)
                        break
                }
                if (param) {
                    params[paramDef.name] = param
                }
            }
        }

        parser.addAction(action)
        actionMap.set(actionDef.name, { action, params })
    }

    return { parser, flags: { historyFlag, verboseFlag, prettyFlag }, actionMap }
}
