import ENV from '../envServer.js'

/** Default preset track for AI-generated demos. */
export const DEFAULT_BACKGROUND_MUSIC = {
  name: 'Future',
  url: `${ENV.LIVEDEMO_CDN_URL.replace(/\/$/, '')}/${ENV.DEFAULT_BACKGROUND_MUSIC_PATH.replace(/^\//, '')}`,
}
