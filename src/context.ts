
import { StreamLibrary } from "./persistence"
import { YouTubeService } from "./service"

export interface Context {
    service: YouTubeService
    library?: StreamLibrary
    verbose: boolean
    pretty?: number
}
