
# YTManager or Youtube Manager

Used mainly for setting up current live stream info on Youtube Or get JSON info about current live stream and video attached to it

## Setup

```sh
npm ci
npm run build
npm start
```

## Usage

```sh
npm start -- --help
# For detailed help about a specific command:
npm start -- <command> --help
```

---

## CLI & API Reference

Each command is available as a CLI action and most are also exposed via the REST API.


### `info`

**Summary:** Get current stream info

Will return broadcast and video info

#### API Endpoint
**Method:** `GET`  
**Path:** `/stream/info`  

***

### `set-title`

**Summary:** Set stream title

Set your stream title

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--title <TITLE>` | `string` | Title to set | ✅ | - | - | `title` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/stream/title`  

***

### `set-live-stream`

**Summary:** Set live stream info

Set your live stream info

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--title <TITLE>` | `string` | Title to set |  | - | - | `title` |
| `--description <DESCRIPTION>` | `string` | Description to set |  | - | - | `description` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/stream/live`  

***

### `get-playlists`

**Summary:** get playlists

Get playlists by name

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--playlist <PLAYLIST>` | `stringList` | Playlist name | ✅ | - | - | `playlist` |

#### API Endpoint
**Method:** `GET`  
**Path:** `/playlists`  

***

### `get-playlist`

**Summary:** get playlist id

Get playlist id by name

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--playlist <PLAYLIST>` | `string` | Playlist name | ✅ | - | - | `playlist` |

#### API Endpoint
**Method:** `GET`  
**Path:** `/playlist`  

***

### `vertical-saved`

**Summary:** lookup and link saved vertical to current stream

Look for a vertical saved in the vertical folder and link it to current stream

#### API Endpoint
**Method:** `GET`  
**Path:** `/verticals/saved`  

***

### `vertical-info`

**Summary:** update last saved vertical linked to current stream with info

Update info of last vertical linked to current stream with info

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--title <TITLE>` | `string` | Title to set |  | - | - | `title` |
| `--description <DESCRIPTION>` | `string` | Description to set |  | - | - | `description` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/verticals/info`  

***

### `verticals-upload`

**Summary:** Upload your vertical to YT

Use it to upload your vertical to YT

#### API Endpoint
**Method:** `POST`  
**Path:** `/verticals/upload`  

***

### `stream-settings`

**Summary:** Change stream settings

Use this command to change the settings

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--vertical-path <VERTICAL_PATH>` | `string` | Change the lookup path for verticals |  | - | - | `vertical-path` |
| `--vertical-visibility` | `choice` | Set the visibility of the vertical<br>Choices: `public, unlisted, private` |  | - | `VERTICAL_VISIBILITY` | `vertical-visibility` |
| `--vertical-add-link-to-video` | `choice` | Add a video link to the vertical<br>Choices: `true, false` |  | - | `ADD_LINK_TO_VIDEO` | `vertical-add-link-to-video` |
| `--vertical-link-offset <VERTICAL_LINK_OFFSET>` | `integer` | Offset of the video link in the vertical |  | - | `VERTICAL_LINK_OFFSET` | `vertical-link-offset` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/settings`  

***

### `set-current-stream`

**Summary:** set current stream

Set parameters to current stream

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--playlist <PLAYLIST>` | `stringList` | Playlist name |  | - | `PLAYLIST` | `playlist` |
| `--language <LANG>` | `string` | Language name |  | - | `LG` | `language` |
| `--language-sub <LANGSUB>` | `string` | Language subtitle name |  | - | `LGSUB` | `language-sub` |
| `--tag <TAG>` | `stringList` | Tag |  | - | `TAG` | `tag` |
| `--category <CATEGORY>` | `string` | Category name |  | - | `CATEGORY` | `category` |
| `--subject <SUBJECT>` | `string` | Subject to use at different place |  | - | `SUBJECT` | `subject` |
| `--subject-before-title` | `boolean` | Add subject before title |  | - | `SUBJECT_BEFORE_TITLE` | `subject-before-title` |
| `--subject-after-title` | `boolean` | Add subject after title |  | - | `SUBJECT_AFTER_TITLE` | `subject-after-title` |
| `--subject-separator <SEPARATOR>` | `string` | Subject separator |  | - | `SUBJECT_SEPARATOR` | `subject-separator` |
| `--subject-add-to-tags` | `boolean` | Add subject to tags |  | - | `SUBJECT_ADD_TAGS` | `subject-add-to-tags` |
| `--tags-add-description` | `boolean` | Add tags to description |  | - | `TAGS_ADD_DESCRIPTION` | `tags-add-description` |
| `--tags-description-with-hashtag` | `boolean` | Add # to tags in description |  | - | `TAGS_DESCRIPTION_WITH_HASHTAG` | `tags-description-with-hashtag` |
| `--tags-description-new-line` | `boolean` | Tags in description on new line |  | - | `TAGS_DESCRIPTION_NEW_LINE` | `tags-description-new-line` |
| `--tags-description-white-space <WHITE_SPACE>` | `string` | Tags space replacement in description |  | - | `TAGS_DESCRIPTION_WHITE_SPACE` | `tags-description-white-space` |
| `--title <TITLE>` | `string` | Title to set |  | - | `TITLE` | `title` |
| `--description <DESCRIPTION>` | `string` | Description to set |  | - | `DESCRIPTION` | `description` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/stream/current`  

***

### `set-timestamps`

**Summary:** Set timestamps

Set timestamps

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--timestamp-title <TIMESTAMP_TITLE>` | `string` | Timestamp in description |  | - | `TIMESTAMP_TITLE` | `timestamp-title` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/stream/timestamps`  

***

### `set-current-thumbnail`

**Summary:** set current thumbnail

Set thumbnail to current stream

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--path-file <PATH_FILE>` | `string` | File path of the thumbnail |  | - | `PATH_FILE` | `path-file` |
| `--path-dir <PATH_DIR>` | `string` | Dir path of the thumbnail |  | - | `PATH_DIR` | `path-dir` |
| `--auto-recompress-on-limit` | `boolean` | Auto recompress image |  | - | `AUTO_RECOMPRESS_ON_LIMIT` | `auto-recompress-on-limit` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/stream/thumbnail`  

***

### `update-dock-redirect`

**Summary:** Update html redirect page dock to youtube chat

Update html redirect page dock to youtube chat

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--path-file <PATH_FILE>` | `string` | File path of the page dock |  | - | `PATH_FILE` | `path-file` |
| `--waiting-redirect` | `boolean` | Generate a html page redirecting to itself |  | - | `WAITING_REDIRECT` | `waiting-redirect` |
| `--refresh-time <REFRESH_TIME>` | `integer` | Refresh page after X seconds |  | `15` | `REFRESH_TIME` | `refresh-time` |

#### API Endpoint
**Method:** `PUT`  
**Path:** `/dock-redirect`  

***

### `serve`

**Summary:** Start REST API server

Start a local REST API server to access ytmanager features via HTTP endpoints

#### Parameters

| Name | Type | Description | Required | Default | ENV | API Key |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `--port <PORT>` | `integer` | Port to run the API server on |  | `3001` | - | `port` |
| `--host <HOST>` | `string` | Host to bind the API server to |  | `localhost` | - | `host` |

***

## License

MIT
