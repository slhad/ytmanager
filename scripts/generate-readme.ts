import { actions } from "../src/actions"
import { writeFileSync, readFileSync } from "fs"

const HEADER = `
# YTManager or Youtube Manager

Used mainly for setting up current live stream info on Youtube Or get JSON info about current live stream and video attached to it

## Setup

\`\`\`sh
npm ci
npm run build
npm start
\`\`\`

## Usage

\`\`\`sh
npm start -- --help
# For detailed help about a specific command:
npm start -- <command> --help
\`\`\`

---

## CLI & API Reference

Each command is available as a CLI action and most are also exposed via the REST API.

`

function generateDocs() {
    let md = HEADER

    for (const action of actions) {
        md += `\n### \`${action.name}\`\n\n`
        md += `**Summary:** ${action.summary}\n\n`
        md += `${action.description}\n\n`

        if (action.parameters && action.parameters.length > 0) {
            md += `#### Parameters\n\n`
            md += `| Name | Type | Description | Required | Default | ENV | API Key |\n`
            md += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n`

            for (const param of action.parameters) {
                const required = param.required ? "✅" : ""
                const defaultValue = param.defaultValue !== undefined ? `\`${param.defaultValue}\`` : "-"
                const env = param.environmentVariable ? `\`${param.environmentVariable}\`` : "-"
                const alternatives = param.alternatives ? `<br>Choices: \`${param.alternatives.join(", ")}\`` : ""
                const argName = param.argumentName ? ` <${param.argumentName}>` : ""

                md += `| \`--${param.name}${argName}\` | \`${param.type}\` | ${param.description}${alternatives} | ${required} | ${defaultValue} | ${env} | \`${param.name}\` |\n`
            }
            md += `\n`
        }

        if (action.api && action.api.path) {
            md += `#### API Endpoint\n`
            md += `**Method:** \`${action.api.method || "GET"}\`  \n`
            md += `**Path:** \`${action.api.path}\`  \n\n`
        }

        md += `***\n`
    }

    md += `\n## License\n\nMIT\n`

    writeFileSync("README.md", md)
    console.log("README.md generated successfully!")
}

generateDocs()
