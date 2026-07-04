/**
 * livedemo-ai-api / consumer.js
 *
 * Monq worker that processes `processUrlDemo` jobs enqueued by livedemo-backend.
 *
 * Job params: { urlDemoId, userId? }
 *
 * Env:
 *   DB_URI               – MongoDB connection string
 *   DEFAULT_WORKSPACE_ID – fallback workspaceId when userId not provided
 */

import monq from 'monq'
import ENV from './envServer.js'
import { setupDB, getModels } from './db/index.js'
import { generateDemo } from './server.js'

async function processUrlDemo(Models, params, callback) {
  const { urlDemoId, userId, shouldCreateStandard } = params

  console.log(`[processUrlDemo] start urlDemoId=${urlDemoId} userId=${userId}`)

  if (!urlDemoId) {
    return callback(new Error('processUrlDemo: urlDemoId param missing'))
  }

  try {
    const urlDemoDoc = await Models.UrlDemo.findOne({ _id: urlDemoId }).lean()
    if (!urlDemoDoc) {
      return callback(new Error(`processUrlDemo: UrlDemo not found urlDemoId=${urlDemoId}`))
    }

    const { url } = urlDemoDoc
    if (!url) {
      return callback(new Error(`processUrlDemo: UrlDemo has no url urlDemoId=${urlDemoId}`))
    }

    console.log(`[processUrlDemo] url=${url}`)
    await generateDemo(Models, { url, userId: userId || null, urlDemoId, shouldCreateStandard })
    console.log(`[processUrlDemo] done urlDemoId=${urlDemoId}`)
    callback(null, { urlDemoId })
  } catch (err) {
    console.error(`[processUrlDemo] failed urlDemoId=${urlDemoId}`, err)
    callback(err)
  }
}

export async function startConsumer() {
  const conn = await setupDB()
  const Models = getModels(conn)
  console.log('[consumer] db connected')

  const client = monq(ENV.DB_URI)
  const worker = client.worker(['urlDemos'], {
    collection: 'jobs-monq',
    callbacks: {
      processUrlDemo: (params, callback) => processUrlDemo(Models, params, callback),
    },
  })

  worker.start()
  console.log('[consumer] listening on queue: urlDemos')
}
