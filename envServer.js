import dotenv from 'dotenv'

dotenv.config()

export default {
  'ENV': process.env.ENV ? process.env.ENV : "",
  'ENABLE_API': process.env.ENABLE_API !== undefined ? process.env.ENABLE_API.toLowerCase() === 'true' : "",
  'ENABLE_CONSUMER': process.env.ENABLE_CONSUMER !== undefined ? process.env.ENABLE_CONSUMER.toLowerCase() === 'true' : "",
  'PORT': process.env.PORT ? process.env.PORT : 3001,
  'DB_URI': process.env.DB_URI ? process.env.DB_URI : "mongodb://localhost:27017/livedemo_app",
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY : "",
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY : "",
  'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY : "",
  'ELEVENLABS_DEFAULT_VOICE_ID': process.env.ELEVENLABS_DEFAULT_VOICE_ID ? process.env.ELEVENLABS_DEFAULT_VOICE_ID : "",
  'LIVEDEMO_CDN_URL': process.env.LIVEDEMO_CDN_URL ? process.env.LIVEDEMO_CDN_URL : "",
  'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID : "",
  'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY ? process.env.AWS_SECRET_ACCESS_KEY : "",
  'AWS_REGION': process.env.AWS_REGION ? process.env.AWS_REGION : "us-east-1",
  'LIVEDEMO_CDN_BUCKET': process.env.LIVEDEMO_CDN_BUCKET ? process.env.LIVEDEMO_CDN_BUCKET : "livedemo-cdn",
  'DEFAULT_WORKSPACE_ID': process.env.DEFAULT_WORKSPACE_ID
    ? process.env.DEFAULT_WORKSPACE_ID
    : (process.env.WORKSPACE_ID ? process.env.WORKSPACE_ID : "634ec9890af91d52423ff103"),
  'USER_ID': process.env.USER_ID ? process.env.USER_ID : "",
}
