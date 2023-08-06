# YTManager or Youtube Manager

## Description
Used mainly for setting up current live stream info on Youtube
Or get JSON info about current live stream and video attached to it

## Setup

```
npm ci
npm run build
npm start
```
First run will ask you


```
usage: ytmanager [-h] [-v] [-p NUMBER] <command> ...

Positional arguments:
  <command>
    info                Get current stream info
    get-playlists       get playlists
    get-playlist        get playlist id
    set-current-stream  set current stream

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --verbose         Verbose logging
  -p NUMBER, --pretty NUMBER
                        Pretty print logging

For detailed help about a specific command, use: ytmanager <command> -h
```

## Usage

To use the command line parser, you can run the following commands:

### Get Current Stream Info

```
ytmanager info
```

This command will return the current broadcast and video info.

### Set Stream Title

```
ytmanager set-title --title <title>
```

This command allows you to set the stream title. Replace `<title>` with the desired title.

### Get Playlists

```
ytmanager get-playlists --playlist <playlist>
```

This command retrieves playlists by name. Replace `<playlist>` with the desired playlist name.

### Get Playlist ID

```
ytmanager get-playlist --playlist <playlist>
```

This command retrieves the playlist ID by name. Replace `<playlist>` with the desired playlist name.

### Set Current Stream

```
ytmanager set-current-stream --playlist <playlist> --language <language> --language-sub <language-sub> --tag <tag> --category <category> --subject <subject> --subject-before-title --subject-after-title --subject-separator <separator> --subject-add-to-tags --tags-add-description --tags-description-with-hashtag --tags-description-new-line --tags-description-white-space <white-space> --title <title> --description <description>
```

This command allows you to set various parameters for the current stream. Replace the placeholders with the desired values.
