/**
 * Mirrors livedemo-backend/src/helpers/cloneUrlDemoStoriesForUser.js
 * (clone strategy kept in sync across both services).
 *
 * Clones a Story + its Screens, generating brand new ids for both.
 * `gotoScreen` references (step popup buttons + customTransitions) are
 * remapped by matching a screen's `index` field to the cloned screen
 * sharing that same `index` value, falling back to the first cloned
 * screen if no match is found.
 */
import mongoose from 'mongoose'

const { ObjectId } = mongoose.Types

function remapStepsGotoScreen(steps, remapGotoScreen) {
  return (steps || []).map(step => {
    const buttons = step?.view?.popup?.buttons
    if (!buttons?.length) return step

    return {
      ...step,
      view: {
        ...step.view,
        popup: {
          ...step.view.popup,
          buttons: buttons.map(button => ({
            ...button,
            gotoScreen: remapGotoScreen(button.gotoScreen)
          }))
        }
      }
    }
  })
}

function remapTransitionsGotoScreen(transitions, remapGotoScreen) {
  return (transitions || []).map(transition => ({
    ...transition,
    gotoScreen: remapGotoScreen(transition.gotoScreen)
  }))
}

export async function cloneStoryForUser(Models, storyId, { userId, workspaceId } = {}) {
  const storyDoc = await Models.Story.findById(storyId).populate('screens').lean()
  if (!storyDoc) return null

  const newStoryId = new ObjectId()
  const oldScreens = storyDoc.screens || []

  const newScreenIds = oldScreens.map(() => new ObjectId())
  const firstNewScreenId = newScreenIds[0] || null

  const oldScreenIdToScreenIndex = new Map(
    oldScreens.map(screen => [screen._id.toString(), screen.index])
  )
  const newScreenIdByScreenIndex = new Map(
    oldScreens.map((screen, i) => [screen.index, newScreenIds[i]])
  )

  const remapGotoScreen = (gotoScreenId) => {
    if (!gotoScreenId) return gotoScreenId

    const screenIndex = oldScreenIdToScreenIndex.get(gotoScreenId.toString())
    const newScreenId = newScreenIdByScreenIndex.get(screenIndex)

    return newScreenId || firstNewScreenId
  }

  const screenPromises = oldScreens.map((screen, index) => {
    return new Models.Screen({
      ...screen,
      _id: newScreenIds[index],
      storyId: newStoryId,
      workspaceId: workspaceId,
      userId: userId,
      steps: remapStepsGotoScreen(screen.steps, remapGotoScreen),
      customTransitions: remapTransitionsGotoScreen(screen.customTransitions, remapGotoScreen)
    }).save()
  })

  const savedScreens = await Promise.all(screenPromises)
  const screenIds = savedScreens.map(s => s._id)

  await new Models.Story({
    ...storyDoc,
    _id: newStoryId,
    userId: userId,
    workspaceId: workspaceId,
    screens: screenIds
  }).save()

  if (workspaceId) {
    await Models.Workspace.findByIdAndUpdate(workspaceId, {
      $push: { liveDemos: newStoryId }
    })
  }

  return newStoryId
}

/**
 * Clones `sourceStoryId` into a brand new Story + Screens (no userId) and
 * creates a `standard` UrlDemo pointing at it, so future visitors requesting
 * the same url can reuse an already-generated demo.
 */
export async function createStandardUrlDemoFromStory(Models, { url, sourceStoryId, workspaceId }) {
  const newStoryId = await cloneStoryForUser(Models, sourceStoryId, { userId: undefined, workspaceId })
  if (!newStoryId) return null

  return new Models.UrlDemo({
    url,
    type: 'standard',
    status: 'completed',
    storyId: newStoryId,
  }).save()
}
