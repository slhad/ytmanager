import { DynamicCommandLineAction, DynamicCommandLineParser } from "@rushstack/ts-command-line"
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

const playlistsAction = new DynamicCommandLineAction({
    actionName: "get-playlists",
    summary: "get playlists",
    documentation: "Get playlists by name"
})

playlistsAction.defineStringListParameter({
    parameterLongName: "--playlist",
    argumentName: "PLAYLIST",
    description: "Playlist name"
})
clp.addAction(playlistsAction)

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

const setCurrentStreamAction = new DynamicCommandLineAction({
    actionName: "set-current-stream",
    summary: "set current stream",
    documentation: "Set parameters to current stream"
})

setCurrentStreamAction.defineStringListParameter({
    parameterLongName: "--playlist",
    argumentName: "PLAYLIST",
    description: "Playlist name",
    environmentVariable: "PLAYLIST"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--language",
    argumentName: "LANG",
    description: "Language name",
    environmentVariable: "LG"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--language-sub",
    argumentName: "LANGSUB",
    description: "Language subtitle name",
    environmentVariable: "LGSUB"
})
setCurrentStreamAction.defineStringListParameter({
    parameterLongName: "--tag",
    argumentName: "TAG",
    description: "Tag",
    environmentVariable: "TAG"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--category",
    argumentName: "CATEGORY",
    description: "Category name",
    environmentVariable: "CATEGORY"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--subject",
    argumentName: "SUBJECT",
    description: "Subject to use at different place",
    environmentVariable: "SUBJECT"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--subjectBeforeTitle",
    description: "Add subject before title",
    environmentVariable: "SUBJECT_BEFORE_TITLE"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--subjectAfterTitle",
    description: "Add subject after title",
    environmentVariable: "SUBJECT_AFTER_TITLE"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--subjectSeparator",
    argumentName: "SEPARATOR",
    description: "Subject separator",
    environmentVariable: "SUBJECT_SEPARATOR"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--subjectAddToTags",
    description: "Add subject to tags",
    environmentVariable: "SUBJECT_ADD_TAGS"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tagsAddDescription",
    description: "Add tags to description",
    environmentVariable: "TAGS_ADD_DESCRIPTION"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tagsDescriptionWithHashtag",
    description: "Add # to tags in description",
    environmentVariable: "TAGS_DESCRIPTION_WITH_HASHTAG"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tagsDescriptionNewLine",
    description: "Tags in description on new line",
    environmentVariable: "TAGS_DESCRIPTION_NEW_LINE"
})
clp.addAction(setCurrentStreamAction)

export const commandLineParser = {
    cmd: clp,
    flags: {
        verboseFlag,
        prettyFlag
    },
    actions: {
        setTitleAction,
        playlistsAction,
        playlistIdAction,
        infoAction,
        setCurrentStreamAction
    }
}