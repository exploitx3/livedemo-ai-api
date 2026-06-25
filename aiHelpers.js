import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import ENV from './envServer.js'

export const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY })

const genai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY })

const OPENAI_MODEL = 'gpt-5.5'
const GEMINI_MODEL = 'gemini-2.5-flash'

const PROMPT = (label, url) => `You are writing step text for a product demo of ${url}.
            

This screenshot shows the "${label}" section.
Write one sentence describing the core user benefit shown.
what value it communicates, and what action it drives.
Be specific to what you actually see.

## Rules
- Start with an action verb ("Share", "Explore", "Create", "Track", "Build"…)
- 8–14 words total
- Exactly one '<strong>' wrapping the most memorable 2–4 word outcome
- Casual, punchy tone — like a product tagline
- No extra tags, no punctuation after '</span>'

## What to bold
The unique thing this feature *enables* — the 2–4 words a user would remember.

## Examples

Image → song clip sent as a looping card in chat:
"""html
<span>Share songs as <strong>bite-sized moments</strong>, not "skip to 2:45" messages.</span>
"""

Image → trending feed with a remix button:
"""html
<span>Explore what's trending and instantly <strong>remix the vibe</strong> into your own.</span>
"""

Image → editor with trim, caption field, and multi-platform share icons:
"""html
<span>Create in seconds: trim, caption, and <strong>post anywhere</strong> for maximum reaction.</span>
""" `

export async function generateStepText(imageBase64, label, url, timer) {
  const t = timer(`openai caption "${label}"`)
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: PROMPT(label, url),
          },
        ],
      },
    ],
  })
  t.end()
  return response.choices[0].message.content.trim()
}

export const AI_PROVIDER = Object.freeze({
  OPENAI: 'openai',
  GEMINI: 'gemini',
})

export async function generateStepTextWithAI(imageBase64, label, url, timer, provider = AI_PROVIDER.OPENAI) {
  if (provider === AI_PROVIDER.GEMINI) {
    return generateStepTextWithGemini(imageBase64, label, url, timer)
  }
  return generateStepText(imageBase64, label, url, timer)
}

export async function generateStepTextWithGemini(imageBase64, label, url, timer) {
  const t = timer(`gemini caption "${label}"`)
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64,
            },
          },
          {
            text: PROMPT(label, url),
          },
        ],
      },
    ],
  })
  t.end()
  return response.text.trim()
}
