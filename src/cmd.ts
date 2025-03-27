import { DynamicCommandLineAction, DynamicCommandLineParser } from "@rushstack/ts-command-line"
import { name, description } from "../package.json"
const clp = new DynamicCommandLineParser({
    toolFilename: name,
    toolDescription: description
})

const historyFlag = clp.defineFlagParameter({
    parameterLongName: "--history",
    parameterShortName: "-H",
    description: "Save your stream and vertical info if queried/updated"
})

const verboseFlag = clp.defineFlagParameter({
    parameterLongName: "--verbose",
    parameterShortName: "-v",
    description: "Verbose logging",
})

const prettyFlag = clp.defineIntegerParameter({
    parameterLongName: "--pretty",
    parameterShortName: "-p",
    argumentName: "NUMBER",
    description: "Pretty print logging",
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

const verticalSavedAction = new DynamicCommandLineAction({
    actionName: "vertical-saved",
    summary: "lookup and link saved vertical to current stream",
    documentation: "Look for a vertical saved in the vertical folder and link it to current stream"
})
clp.addAction(verticalSavedAction)

const verticalInfoAction = new DynamicCommandLineAction({
    actionName: "vertical-info",
    summary: "update last saved vertical linked to current stream with info",
    documentation: "Update info of last vertical linked to current stream with info"
})
verticalInfoAction.defineStringParameter({
    parameterLongName: "--title",
    argumentName: "TITLE",
    description: "Title to set"
})
verticalInfoAction.defineStringParameter({
    parameterLongName: "--description",
    argumentName: "DESCRIPTION",
    description: "Description to set"
})
clp.addAction(verticalInfoAction)

const verticalsUpload = new DynamicCommandLineAction({
    actionName: "verticals-upload",
    summary: "Upload your vertical to YT",
    documentation: "Use it to upload your vertical to YT"
})
clp.addAction(verticalsUpload)

const reconstructStreamsFromVerticals = new DynamicCommandLineAction({
    actionName: "reconstruct-streams-from-verticals",
    summary: "WIP - It will try to look at your saved verticals no in library to guess a YT stream and save them in library",
    documentation: "Use it reconstruct library from verticals"
})
clp.addAction(reconstructStreamsFromVerticals)


const streamSettingsAction = new DynamicCommandLineAction({
    actionName: "stream-settings",
    summary: "Change stream settings",
    documentation: "Use this command to change the settings"
})
clp.addAction(streamSettingsAction)
streamSettingsAction.defineStringParameter({
    parameterLongName: "--vertical-path",
    argumentName: "VERTICAL_PATH",
    description: "Change the lookup path for verticals"
})
streamSettingsAction.defineChoiceParameter({
    alternatives: ["public", "unlisted", "private"],
    parameterLongName: "--vertical-visibility",
    description: "Set the visibility of the vertical",
    environmentVariable: "VERTICAL_VISIBILITY"
})
streamSettingsAction.defineChoiceParameter({
    alternatives: ["true", "false"],
    parameterLongName: "--vertical-add-link-to-video",
    description: "Add a video link to the vertical",
    environmentVariable: "ADD_LINK_TO_VIDEO"
})
streamSettingsAction.defineIntegerParameter({
    parameterLongName: "--vertical-link-offset",
    argumentName: "VERTICAL_LINK_OFFSET",
    description: "Offset of the video link in the vertical",
    environmentVariable: "VERTICAL_LINK_OFFSET"
})

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
    parameterLongName: "--subject-before-title",
    description: "Add subject before title",
    environmentVariable: "SUBJECT_BEFORE_TITLE"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--subject-after-title",
    description: "Add subject after title",
    environmentVariable: "SUBJECT_AFTER_TITLE"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--subject-separator",
    argumentName: "SEPARATOR",
    description: "Subject separator",
    environmentVariable: "SUBJECT_SEPARATOR"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--subject-add-to-tags",
    description: "Add subject to tags",
    environmentVariable: "SUBJECT_ADD_TAGS"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tags-add-description",
    description: "Add tags to description",
    environmentVariable: "TAGS_ADD_DESCRIPTION"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tags-description-with-hashtag",
    description: "Add # to tags in description",
    environmentVariable: "TAGS_DESCRIPTION_WITH_HASHTAG"
})
setCurrentStreamAction.defineFlagParameter({
    parameterLongName: "--tags-description-new-line",
    description: "Tags in description on new line",
    environmentVariable: "TAGS_DESCRIPTION_NEW_LINE"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--tags-description-white-space",
    argumentName: "WHITE_SPACE",
    description: "Tags space replacement in description",
    environmentVariable: "TAGS_DESCRIPTION_WHITE_SPACE"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--title",
    argumentName: "TITLE",
    description: "Title to set",
    environmentVariable: "TITLE"
})
setCurrentStreamAction.defineStringParameter({
    parameterLongName: "--description",
    argumentName: "DESCRIPTION",
    description: "Description to set",
    environmentVariable: "DESCRIPTION"
})
clp.addAction(setCurrentStreamAction)

const setTimestampsAction = new DynamicCommandLineAction({
    actionName: "set-timestamps",
    summary: "Set timestamps",
    documentation: "Set timestamps"
})
setTimestampsAction.defineStringParameter({
    parameterLongName: "--timestamp-title",
    argumentName: "TIMESTAMP_TITLE",
    description: "Timestamp in description",
    environmentVariable: "TIMESTAMP_TITLE"
})
clp.addAction(setTimestampsAction)

const setCurrentThumbnailAction = new DynamicCommandLineAction({
    actionName: "set-current-thumbnail",
    summary: "set current thumbnail",
    documentation: "Set thumbnail to current stream"
})

setCurrentThumbnailAction.defineStringParameter({
    parameterLongName: "--path-file",
    argumentName: "PATH_FILE",
    description: "File path of the thumbnail",
    environmentVariable: "PATH_FILE"
})

setCurrentThumbnailAction.defineStringParameter({
    parameterLongName: "--path-dir",
    argumentName: "PATH_DIR",
    description: "Dir path of the thumbnail, will take most recent supported file",
    environmentVariable: "PATH_DIR"
})

setCurrentThumbnailAction.defineFlagParameter({
    parameterLongName: "--auto-recompress-on-limit",
    description: "Auto recompress image if Youtube thumbnail limit is reached",
    environmentVariable: "AUTO_RECOMPRESS_ON_LIMIT"
})
clp.addAction(setCurrentThumbnailAction)

const updateDockRedirectAction = new DynamicCommandLineAction({
    actionName: "update-dock-redirect",
    summary: "Update html redirect page dock to youtube chat",
    documentation: "Update html redirect page dock to youtube chat"
})

updateDockRedirectAction.defineStringParameter({
    parameterLongName: "--path-file",
    argumentName: "PATH_FILE",
    description: "File path of the page dock",
    environmentVariable: "PATH_FILE"
})

updateDockRedirectAction.defineFlagParameter({
    parameterLongName: "--waiting-redirect",
    description: "Generate a html page redirecting to itself, usefull if YT stream is not launched yet or has finished",
    environmentVariable: "WAITING_REDIRECT"
})

updateDockRedirectAction.defineIntegerParameter({
    parameterLongName: "--refresh-time",
    argumentName: "REFRESH_TIME",
    description: "Refresh page after X seconds",
    environmentVariable: "REFRESH_TIME",
    defaultValue: 15
})

clp.addAction(updateDockRedirectAction)


export const commandLineParser = {
    cmd: clp,
    flags: {
        verboseFlag,
        prettyFlag,
        historyFlag
    },
    actions: {
        setTitleAction,
        playlistsAction,
        playlistIdAction,
        verticalInfoAction,
        verticalSavedAction,
        verticalsUpload,
        streamSettingsAction,
        setTimestampsAction,
        infoAction,
        setCurrentStreamAction,
        setCurrentThumbnailAction,
        updateDockRedirectAction
    }
}