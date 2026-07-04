/**
 * DB setup — schemas exactly mirror livedemo-backend/src/models/Story.js
 * and livedemo-backend/src/models/ScreenStep.js
 */

import mongoose from 'mongoose'
import ENV from '../envServer.js'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ZoomSpanScreenshotSchema = new mongoose.Schema({
  delay: { type: Number, default: 0.5 },
  duration: { type: Number, default: 1.5 },
  width: { type: Number },
  height: { type: Number },
  editorWidth: { type: Number },
  editorHeight: { type: Number },
  offsetX: { type: Number },
  offsetY: { type: Number },
})

const ScreenStepSchema = new mongoose.Schema(
  {
    index: { type: Number },
    view: {
      viewType: { type: String, default: 'hotspot' }, // hotspot, pointer, popup, none
      pointer: {
        selector: { type: String, default: '' },
        selectorLocation: {
          positionX: { type: Number, default: 200 },
          positionY: { type: Number, default: 200 },
          width: { type: Number, default: 150 },
          height: { type: Number, default: 50 },
        },
        placement: { type: String, default: 'auto' },
      },
      hotspot: {
        frameX: { type: Number, default: 200 },
        frameY: { type: Number, default: 200 },
        placement: { type: String, default: 'auto' },
      },
      popup: {
        type: { type: String, default: 'popup' }, // popup, form, embed, start, iframe
        formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', default: null },
        embedHtmlContent: { type: String, default: null },
        showOverlay: { type: Boolean, default: false },
        overlayBackgroundColor: { type: String, default: 'rgba(0,0,0,0.65)' },
        title: { type: String, default: 'Title' },
        description: { type: String, default: '<p>Description</p>' },
        alignment: { type: String, default: 'center' },
        showPreviewImage: { type: Boolean, default: false },
        previewImageUrl: { type: String, default: '' },
        buttons: [
          {
            index: { type: Number, default: 0 },
            text: { type: String, default: 'Next' },
            gotoType: { type: String },
            gotoWebsite: { type: String },
            gotoScreen: { type: mongoose.Schema.Types.ObjectId, ref: 'Screen' },
            textColor: { type: String, default: '#FFFFFF' },
            backgroundColor: { type: String, default: '#1070ff' },
          },
        ],
      },
      content: { type: String, default: '' },
      nextButtonText: { type: String, default: 'Next' },
      showStepNumbers: { type: Boolean, default: true },
      showHeader: { type: Boolean, default: false },
      showFooter: { type: Boolean, default: false },
    },
    zoomSpan: ZoomSpanScreenshotSchema,
    stepAudioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audio', default: null },
    elementData: {
      targetHTML: { type: String, default: '' },
      targetElementType: { type: String, default: 'element' },
      targetText: { type: String, default: '' },
    },
    autoPlayConfig: {
      enabled: { type: Boolean, default: false },
      type: { type: String, default: 'auto' }, // auto, manual
      delay: { type: Number, default: 2 },
    },
    action: {
      actionType: { type: String, default: 'NextButton' }, // NextButton, ElementClick
      selector: { type: String, default: '' },
    },
  },
  { _id: true }
)

const ScreenSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    type: { type: String, default: 'Screen_Screenshot' },
    steps: [ScreenStepSchema],
    customTransitions: { type: Array, default: [] },
    index: { type: Number },
    imageUrl: { type: String },
  },
  {
    strict: true,
    timestamps: { createdAt: true, updatedAt: true },
    discriminatorKey: 'type',
  }
)

const StorySchema = new mongoose.Schema(
  {
    name: { type: String },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    screens: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Screen' }],
      default: [],
    },
    filePath: { type: String, default: '' },
    status: { type: String, default: 'uploading' },
    demoSuggestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoSuggestion' },
    isPublished: { type: Boolean, default: false },
    type: { type: String, default: 'web' }, // web, desktop
    capturedEvents: [],
    tabInfo: {},
    windowMeasures: {},
    videoStartMs: { type: Number },
    videoEndMs: { type: Number },
    aspectRatio: { type: String },
    hasCursorPositions: { type: Boolean },
    content: {
      contentStatus: { type: String, default: '' },
      contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoryContent' },
    },
    custom: {
      header: {
        isActive: { type: Boolean, default: false },
        imageUrl: { type: String, default: '' },
        personName: { type: String, default: '' },
        text: { type: String, default: '' },
      },
      theme: {
        isActive: { type: Boolean, default: false },
        stepBackgroundColor: { type: String, default: '#1070ff' },
        backgroundColor: { type: String, default: '#FFFFFF' },
        textColor: { type: String, default: '#FFFFFF' },
        buttonBackgroundColor: { type: String, default: '#1070ff' },
        buttonTextColor: { type: String, default: '#FFFFFF' },
        watermarkConfig: {
          imageUrl: { type: String, default: '' },
          text: { type: String, default: '' },
          url: { type: String, default: '' },
          isActive: { type: Boolean, default: false },
        },
      },
      misc: {
        isActive: { type: Boolean, default: false },
        confettiOnLastStep: { type: Boolean, default: true },
        isOmniBarDisabled: { type: Boolean, default: false },
        isLiveDemoWatermarkEnabled: { type: Boolean, default: true },
        isTabsEnabled: { type: Boolean, default: true },
      },
      background: {
        isActive: { type: Boolean, default: false },
        backgroundColor: { type: String, default: '#FFFFFF' },
        backgroundBlur: { type: Number, default: 0 },
        backgroundType: { type: String, default: 'color' },
        wallpaperImage: { type: String, default: '' },
        padding: { type: Number, default: 24 },
      },
      backgroundMusic: {
        isActive: { type: Boolean, default: false },
        backgroundMusicUrl: { type: String, default: '' },
        backgroundMusicVolume: { type: Number, default: 50 },
      },
      variables: [{ name: String, value: String }],
      security: {
        additionalContentSecurityPolicy: { type: String, default: '' },
      },
    },
    thumbnailImageUrl: { type: String, default: '' },
    links: [{ type: String, ref: 'Link' }],
    deletedAt: { type: Date, default: null },
  },
  {
    strict: true,
    timestamps: { createdAt: true, updatedAt: true },
  }
)

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    type: { type: String, default: '' },
    integrations: {
      hubspot: { type: Boolean, default: false },
    },
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }],
    liveDemos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiveDemo' }],
    invitedEmails: [{ type: String }],
    library: {
      pages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Screen' }],
      screenshots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Screen' }],
      videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Screen' }],
    },
  },
  { strict: false, timestamps: { createdAt: true, updatedAt: true } }
)

const UrlDemoSchema = new mongoose.Schema(
  {
    url: { type: String },
    browserSessionId: { type: String },
    type: { type: String, default: 'standard' }, //enum: ['standard', 'browsed', 'owned'] 
    storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    status: { type: String, default: 'processing' }, //, enum: ['processing', 'completed'] 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { strict: true, timestamps: true }
)

// ─── Connection + model init ─────────────────────────────────────────────────

export const setupDB = async () => {
  const conn = mongoose.createConnection(ENV.DB_URI, {
    bufferCommands: false,
    directConnection: true,
  })

  await conn.asPromise()

  conn.model('Screen', ScreenSchema)
  conn.model('Story', StorySchema)
  conn.model('Workspace', WorkspaceSchema)
  conn.model('UrlDemo', UrlDemoSchema)

  return conn
}

export const getModels = (conn) => ({
  Screen: conn.model('Screen'),
  Story: conn.model('Story'),
  Workspace: conn.model('Workspace'),
  UrlDemo: conn.model('UrlDemo'),
})
