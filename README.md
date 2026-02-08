# ytmanager

balkbaba

## Install

```sh
$ npm i ytmanager -g
```

## Usage

```sh
$ ytmanager --help
```

Help output:

```
usage: ytmanager [-h] [-H] [-v] [-p NUMBER] <command> ...

Positional arguments:
  <command>
    info                Get current stream info
    set-title           Set stream title
    set-live-stream     Set live stream info
    get-playlists       get playlists
    get-playlist        get playlist id
    vertical-saved      lookup and link saved vertical to current stream
    vertical-info       update last saved vertical linked to current stream 
                        with info
    verticals-upload    Upload your vertical to YT
    stream-settings     Change stream settings
    set-current-stream  set current stream
    set-timestamps      Set timestamps
    set-current-thumbnail
                        set current thumbnail
    update-dock-redirect
                        Update html redirect page dock to youtube chat
    serve               Start REST API server

Optional arguments:
  -h, --help            Show this help message and exit.
  -H, --history         Save your stream and vertical info if queried/updated
  -v, --verbose         Verbose logging
  -p NUMBER, --pretty NUMBER
                        Pretty print logging

[1mFor detailed help about a specific command, use: ytmanager <command> 
-h[22m
```

## License

MIT.