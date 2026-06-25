/**
 * livedemo-ai-api / server.js
 *
 * POST /generate-demo
 *   Body: { url, workspaceId, userId }
 *   Returns: { storyId, screens: [...] }
 *
 * Env:
 *   Copy local.env to .env and fill in secrets (see README.md).
 *   ENABLE_API / ENABLE_CONSUMER — toggle HTTP server and monq worker
 *   PORT          — default 3001
 *   DB_URI        — MongoDB connection string
 *   OPENAI_API_KEY
 */

import { fileURLToPath } from 'url'
import express from 'express'
import mongoose from 'mongoose'
import {chromium} from 'playwright'
import {S3Client} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import ENV from './envServer.js'
import {getModels, setupDB} from './db/index.js'
import {AI_PROVIDER, generateStepTextWithAI} from './aiHelpers.js'
import {startConsumer} from './consumer.js'

const s3 = new S3Client({
    region: ENV.AWS_REGION,
    credentials: {
        accessKeyId: ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
})

async function uploadImageToS3(buffer, key) {
    const upload = new Upload({
        client: s3,
        params: {
            Bucket: ENV.LIVEDEMO_CDN_BUCKET,
            Key: `flix-images/${key}.png`,
            Body: buffer,
            ACL: 'public-read',
            ContentType: 'image/png',
        },
    })
    const result = await upload.done()
    return result.Location
}

const PORT = ENV.PORT

function timer(label) {
    const t0 = Date.now()
    console.log(`${new Date(t0).toISOString()} [start] ${label}`)
    return {
        end: () => {
            const t1 = Date.now()
            const ms = t1 - t0
            const sec = (ms / 1000).toFixed(1) + 's'
            console.log(`${new Date(t1).toISOString()} [end]   ${label} — ${sec}`)
            return ms
        },
    }
}

const VIEWPORT = {width: 1440, height: 900}

const SHOTS = [
    {name: 'hero', scrollY: 0, label: 'Hero / Above the fold'},
    {name: 'features', scrollY: 0.40, label: 'Features section'},
    {name: 'cta', scrollY: 0.80, label: 'Call-to-action / Footer'},
]

// ─── Singleton browser ───────────────────────────────────────────────────────

let sharedBrowser = null

async function getSharedBrowser() {
    if (sharedBrowser && sharedBrowser.isConnected()) {
        return sharedBrowser
    }
    console.log('[browser] launching singleton chromium...')
    sharedBrowser = await chromium.launch({headless: true})
    sharedBrowser.on('disconnected', () => {
        console.warn('[browser] chromium disconnected — relaunching immediately...')
        sharedBrowser = null
        getSharedBrowser().catch(err => console.error('[browser] relaunch failed:', err))
    })
    console.log('[browser] singleton chromium ready')
    return sharedBrowser
}

export async function launchSharedBrowser() {
    await getSharedBrowser()
}

// ─── Screenshot + Caption pipeline ─────────────────────────────────────────

async function captureAndCaption(url) {
    const tTotal = timer('captureAndCaption total')

    const browser = await getSharedBrowser()
    const page = await browser.newPage({viewport: VIEWPORT})

    try {
        const tNav = timer(`page.goto ${url}`)
        // 'networkidle' hangs on sites with persistent connections (websockets, ads, analytics).
        // Use 'load' instead and wait briefly for JS rendering to settle.
        await page.goto(url, {waitUntil: 'load', timeout: 30_000})
        await page.waitForTimeout(1_500)
        tNav.end()

        const {pageHeight, title, windowMeasures} = await page.evaluate(() => ({
            pageHeight: document.body.scrollHeight,
            title: document.title,
            windowMeasures: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
            },
        }))
        const rawShots = []

        for (const shot of SHOTS) {
            const scrollTo = Math.round(shot.scrollY * Math.max(0, pageHeight - VIEWPORT.height))
            await page.evaluate((y) => window.scrollTo({top: y, behavior: 'instant'}), scrollTo)
            await page.waitForTimeout(400)

            const tShot = timer(`screenshot "${shot.name}"`)
            const buffer = await page.screenshot({type: 'png'})
            tShot.end()
            rawShots.push({...shot, buffer, b64: buffer.toString('base64')})
        }

        console.log(`[timer] all ${rawShots.length} screenshots done — starting OpenAI captions in parallel`)
        const tCaptions = timer('all openai captions (parallel)')
        const captioned = await Promise.all(
            rawShots.map(async (s) => {
                const stepText = await generateStepTextWithAI(s.b64, s.label, url, timer, AI_PROVIDER.GEMINI)
                return {...s, stepText}
            })
        )
        tCaptions.end()

        tTotal.end()
        return {captioned, title, windowMeasures}
    } finally {
        await page.close().catch(() => {})
    }
}

// ─── S3 upload ───────────────────────────────────────────────────────────────

async function uploadScreenshots(captioned, storyId) {
    console.log(`[timer] uploading ${captioned.length} screenshots to S3 in parallel`)
    const tAll = timer('all S3 uploads (parallel)')
    const results = await Promise.all(
        captioned.map(async (s) => {
            const key = `${storyId}/${s.name}`
            const tUp = timer(`S3 upload "${s.name}"`)
            const imageUrl = await uploadImageToS3(s.buffer, key)
            tUp.end()
            return {...s, imageUrl}
        })
    )
    tAll.end()
    return results
}

// ─── DB save ────────────────────────────────────────────────────────────────

async function saveToMongo(Models, {captioned, title, url, workspaceId, userId, windowMeasures}) {
    const tTotal = timer('saveToMongo total')
    const ObjectId = mongoose.Types.ObjectId

    const wsId = new ObjectId(workspaceId)
    const uId = userId ? new ObjectId(userId) : undefined

    const storyId = new ObjectId()

    const captionedWithUrls = await uploadScreenshots(captioned, storyId.toString())
    const thumbnailImageUrl = captionedWithUrls[0]?.imageUrl || ''
    const firstImageUrl = thumbnailImageUrl

    const tIntro = timer('mongo save introScreen')
    const introScreen = await new Models.Screen({
        name: 'Intro',
        storyId,
        workspaceId: wsId,
        userId: uId,
        type: 'Screen_Screenshot',
        index: 0,
        imageUrl: firstImageUrl,
        customTransitions: [],
        steps: [
            {
                index: 0,
                view: {
                    viewType: 'popup',
                    pointer: {
                        selector: '',
                        selectorLocation: {
                            positionX: 200,
                            positionY: 200,
                            width: 150,
                            height: 50,
                        },
                        placement: 'auto',
                    },
                    hotspot: {
                        frameX: 200,
                        frameY: 200,
                        placement: 'auto',
                    },
                    popup: {
                        type: 'popup',
                        formId: null,
                        embedHtmlContent: '',
                        showOverlay: true,
                        overlayBackgroundColor: 'rgba(0,0,0,0.65)',
                        title: title || url,
                        description: '<p><br /></p>',
                        alignment: 'left',
                        showPreviewImage: true,
                        previewImageUrl: firstImageUrl,
                        buttons: [
                            {
                                index: 0,
                                text: 'Start',
                                gotoType: 'next',
                                gotoWebsite: '',
                                textColor: '#FFFFFF',
                                backgroundColor: '#1070ff',
                            },
                        ],
                    },
                    content: '<p>New step</p>',
                    nextButtonText: 'Next',
                    showStepNumbers: true,
                    showHeader: false,
                    showFooter: false,
                },
                stepAudioId: null,
                elementData: {
                    targetHTML: '',
                    targetElementType: 'element',
                    targetText: '',
                },
                autoPlayConfig: {
                    enabled: false,
                    type: 'auto',
                    delay: 2,
                },
                action: {
                    actionType: 'NextButton',
                    selector: '',
                },
            },
        ],
    }).save()
    tIntro.end()

    console.log(`[timer] saving ${captionedWithUrls.length} content screens to mongo in parallel`)
    const tScreens = timer('mongo save all content screens (parallel)')
    const screenDocs = await Promise.all(
        captionedWithUrls.map(async (shot, idx) => {
            const tScreen = timer(`mongo save screen "${shot.name}"`)
            const screen = await new Models.Screen({
                name: shot.label,
                storyId,
                workspaceId: wsId,
                userId: uId,
                type: 'Screen_Screenshot',
                index: idx + 1,
                imageUrl: shot.imageUrl,
                steps: [
                    {
                        index: 0,
                        view: {
                            viewType: 'pointer',
                            pointer: {
                                selector: '',
                                selectorLocation: {
                                    positionX: Math.round(VIEWPORT.width / 2 + (Math.random() * 300 - 150)),
                                    positionY: Math.round(VIEWPORT.height / 2 + (Math.random() * 300 - 150)),
                                    width: 150,
                                    height: 50,
                                },
                                placement: 'auto',
                            },
                            hotspot: {
                                frameX: 200,
                                frameY: 200,
                                placement: 'auto',
                            },
                            content: `<p>${shot.stepText}</p>`,
                            popup: {
                                type: 'popup',
                                formId: null,
                                showOverlay: false,
                                overlayBackgroundColor: 'rgba(0,0,0,0.65)',
                                title: 'Title',
                                description: '<p>Description</p>',
                                alignment: 'center',
                                showPreviewImage: false,
                                previewImageUrl: '',
                                buttons: [],
                            },
                            nextButtonText: 'Next',
                            showStepNumbers: true,
                            showHeader: false,
                            showFooter: true,
                        },
                        stepAudioId: null,
                        elementData: {
                            targetHTML: '',
                            targetElementType: 'element',
                            targetText: '',
                        },
                        autoPlayConfig: {
                            enabled: false,
                            type: 'auto',
                            delay: 2,
                        },
                        action: {
                            actionType: 'NextButton',
                            selector: '',
                        },
                    },
                ],
            }).save()
            tScreen.end()
            return screen
        })
    )
    tScreens.end()

    const lastImageUrl = captionedWithUrls[captionedWithUrls.length - 1]?.imageUrl || firstImageUrl

    const tOutro = timer('mongo save outroScreen')
    const outroScreen = await new Models.Screen({
        name: 'Call-to-action / Footer',
        storyId,
        workspaceId: wsId,
        userId: uId,
        type: 'Screen_Screenshot',
        index: screenDocs.length + 1,
        imageUrl: lastImageUrl,
        customTransitions: [],
        steps: [
            {
                index: 0,
                view: {
                    viewType: 'popup',
                    pointer: {
                        selector: '',
                        selectorLocation: {
                            positionX: 200,
                            positionY: 200,
                            width: 150,
                            height: 50,
                        },
                        placement: 'auto',
                    },
                    hotspot: {
                        frameX: 200,
                        frameY: 200,
                        placement: 'auto',
                    },
                    popup: {
                        type: 'popup',
                        showOverlay: true,
                        overlayBackgroundColor: 'rgba(0,0,0,0.65)',
                        title: 'LiveDemo.AI',
                        description: '<p>Capture your product in action and bring it to life as an interactive story</p>',
                        alignment: 'center',
                        showPreviewImage: false,
                        previewImageUrl: lastImageUrl,
                        buttons: [
                            {
                                index: 0,
                                text: 'Record my First LiveDemo',
                                gotoType: 'website',
                                gotoWebsite: 'https://app.livedemo.ai',
                                textColor: '#FFFFFF',
                                backgroundColor: '#1070ff',
                            },
                            {
                                index: 1,
                                text: 'Install Free Extension',
                                gotoType: 'website',
                                gotoWebsite: 'https://chromewebstore.google.com/detail/livedemo-ai-product-demos/dnlnaeifccbhdnbppjjgleapjadjklbe?hl=en-US',
                                textColor: '#FFFFFF',
                                backgroundColor: '#1070ff',
                            },
                            {
                                index: 2,
                                text: 'Download Desktop App',
                                gotoType: 'website',
                                gotoWebsite: 'https://livedemo.ai/',
                                textColor: '#FFFFFF',
                                backgroundColor: '#1070ff',
                            },
                        ],
                    },
                    content: '<p>New step</p>',
                    nextButtonText: 'Next',
                    showStepNumbers: true,
                    showHeader: false,
                    showFooter: false,
                },
                elementData: {
                    targetHTML: '',
                    targetElementType: 'element',
                    targetText: '',
                },
                autoPlayConfig: {
                    enabled: false,
                    type: 'auto',
                    delay: 2,
                },
                action: {
                    actionType: 'NextButton',
                    selector: '',
                },
            },
        ],
    }).save()

    tOutro.end()

    const screenIds = [introScreen._id, ...screenDocs.map((s) => s._id), outroScreen._id]

    const aspectRatio = `${VIEWPORT.width}/${VIEWPORT.height}`

    const tStory = timer('mongo save story')
    const story = await new Models.Story({
        _id: storyId,
        name: title || url,
        workspaceId: wsId,
        userId: uId,
        screens: screenIds,
        status: 'ready',
        type: 'web',
        isPublished: false,
        windowMeasures,
        aspectRatio,
        capturedEvents: [],
        videoStartMs: 0,
        videoEndMs: 0,
        thumbnailImageUrl,
    }).save()
    tStory.end()

    tTotal.end()
    return {story, screenDocs}
}

// ─── Core generateDemo function ──────────────────────────────────────────────

export const DEFAULT_WORKSPACE_ID = ENV.DEFAULT_WORKSPACE_ID

/**
 * Generate a demo story from a URL.
 * @param {object} Models
 * @param {object} params
 * @param {string} params.url
 * @param {string|null} [params.userId]         – if provided, look up latest workspace for user
 * @param {string|null} [params.workspaceId]    – used directly if userId not provided
 * @param {string|null} [params.urlDemoId]      – if provided, update UrlDemo to completed after save
 * @returns {{ story, screenDocs, captioned }}
 */
export async function generateDemo(Models, {url, userId, workspaceId, urlDemoId}) {
    const tReq = timer(`generateDemo total url=${url}`)
    console.log(`[generateDemo] url=${url} userId=${userId} workspaceId=${workspaceId} urlDemoId=${urlDemoId}`)

    let resolvedWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID

    if (userId) {
        const workspaceDoc = await Models.Workspace.findOne(
            {'members.userId': userId},
            {_id: 1}
        )
            .sort({createdAt: -1})
            .lean()

        if (workspaceDoc) {
            resolvedWorkspaceId = workspaceDoc._id.toString()
            console.log(`[generateDemo] resolved workspaceId=${resolvedWorkspaceId} for userId=${userId}`)
        } else {
            console.warn(`[generateDemo] no workspace found for userId=${userId}, using default`)
        }
    }

    if (!resolvedWorkspaceId) {
        throw new Error(
            'workspaceId is required: pass workspaceId or userId, or set DEFAULT_WORKSPACE_ID'
        )
    }

    const tCapture = timer('captureAndCaption phase')
    const {captioned, title, windowMeasures} = await captureAndCaption(url)
    tCapture.end()

    const tSave = timer('saveToMongo phase')
    const {story, screenDocs} = await saveToMongo(Models, {
        captioned,
        title,
        url,
        workspaceId: resolvedWorkspaceId,
        userId,
        windowMeasures,
    })
    tSave.end()

    if (urlDemoId) {
        await Models.UrlDemo.findOneAndUpdate(
            {_id: urlDemoId},
            {$set: {status: 'completed', storyId: story._id}}
        )
        console.log(`[generateDemo] updated UrlDemo ${urlDemoId} → completed, storyId=${story._id}`)
    }

    tReq.end()
    console.log(`[generateDemo] saved storyId=${story._id}`)

    return {story, screenDocs, captioned}
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

let Models = null

app.post('/generate-demo', async (req, res) => {
    const {url, workspaceId, userId} = req.body

    if (!url) {
        return res.status(400).json({error: 'url is required'})
    }
    if (!workspaceId && !userId) {
        return res.status(400).json({error: 'workspaceId or userId is required'})
    }

    try {
        const {story, screenDocs, captioned} = await generateDemo(Models, {url, workspaceId, userId})

        res.json({
            storyId: story._id,
            storyName: story.name,
            screens: screenDocs.map((s, i) => ({
                screenId: s._id,
                index: i,
                label: captioned[i].label,
                stepText: captioned[i].stepText,
            })),
        })
    } catch (err) {
        console.error('[generate-demo] error:', err)
        res.status(500).json({error: err.message})
    }
})

app.get('/health', (_req, res) => res.json({ok: true}))

// ─── Boot ────────────────────────────────────────────────────────────────────

export function getSharedModels() {
    return Models
}

async function boot() {
    if (!ENV.ENABLE_API && !ENV.ENABLE_CONSUMER) {
        console.log('[boot] ENABLE_API and ENABLE_CONSUMER are both disabled, nothing to start')
        return
    }

    await launchSharedBrowser()
    if (ENV.ENABLE_API) {
        const [conn] = await Promise.all([
            setupDB()
        ])
        Models = getModels(conn)
        console.log('[db] connected')

        app.listen(PORT, () => {
            console.log(`[server] listening on http://localhost:${PORT}`)
            console.log(`[server] POST /generate-demo  { url, workspaceId?, userId? }`)
        })
    }

    if (ENV.ENABLE_CONSUMER) {
        startConsumer().catch((err) => {
            console.error('[consumer] boot failed:', err)
            process.exit(1)
        })
    }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)

if (isMainModule) {
    boot().catch((err) => {
        console.error('Boot failed:', err)
        process.exit(1)
    })
}
