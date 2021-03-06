/** This step handles identical renaming on Windows.
 *
 * An identical renaming is a renaming where the source and destination would
 * both have the same identity on the current filesystem:
 *
 * - Names differing only by their case: `foo` vs `Foo` vs `FOO`
 * - Names equivalent from a Unicode point of view
 *
 * @module core/local/atom/win_identical_renaming
 * @flow
 */

const _ = require('lodash')

const Channel = require('./channel')
const logger = require('../../utils/logger')

/*::
import type { AtomEvent, AtomBatch } from './event'
import type { Metadata } from '../../metadata'

type WinIdenticalRenamingState = {
  deletedEventsById: Map<string, AtomEvent>,
  pending: {
    deletedEventsById: Map<string, AtomEvent>,
    events: AtomBatch,
    timeout?: TimeoutID
  }
}

type PouchFunctions = {
  byIdMaybeAsync: (string) => Promise<?Metadata>
}

type WinIdenticalRenamingOptions = {
  pouch: PouchFunctions,
  state: {
    [typeof STEP_NAME]: WinIdenticalRenamingState
  }
}
*/

const STEP_NAME = 'winIdenticalRenaming'

const log = logger({
  component: `atom/${STEP_NAME}`
})

/**
 * Wait at most this delay (in milliseconds) to fix identical renaming related
 * events.
 */
const DELAY = 500

const initialState = () => ({
  [STEP_NAME]: {
    // eslint-disable-next-line
    deletedEventsById: new Map /*:: <string,AtomEvent> */ (),
    pending: {
      // eslint-disable-next-line
      deletedEventsById: new Map /*:: <string,AtomEvent> */ (),
      events: []
    }
  }
})

/** Current batch becomes pending.
 *
 * So we can:
 * - Detect identical renaming events in the next one.
 * - Possibly aggregate broken deleted events from the current (now pending)
 *   one.
 */
const rotateState = (state, events) => {
  state.pending = {
    deletedEventsById: state.deletedEventsById,
    events
  }
  state.deletedEventsById = new Map()
}

/** Broken deleted event ids match identical renamed ones. */
const indexDeletedEvent = (event, state) => {
  if (event.action === 'deleted' && event._id != null) {
    state.deletedEventsById.set(event._id, event)
  }
}

/** Possibly fix oldPath when event is identical renamed. */
const fixIdenticalRenamed = async (event, { byIdMaybeAsync }) => {
  if (event.path === event.oldPath) {
    const doc /*: ?Metadata */ = event._id
      ? await byIdMaybeAsync(event._id)
      : null

    if (doc && !doc.deleted && doc.path !== event.oldPath) {
      _.set(event, [STEP_NAME, 'oldPathBeforeFix'], event.oldPath)
      event.oldPath = doc.path
    }
  }
}

/** Possibly change event action to 'ignored'.
 *
 * In case it is a broken deleted event related to an identical renaming.
 */
const ignoreDeletedBeforeIdenticalRenamed = (event, state) => {
  const { _id: id } = event
  const pendingDeletedEvent =
    id &&
    (state.deletedEventsById.get(id) || state.pending.deletedEventsById.get(id))
  if (pendingDeletedEvent) {
    pendingDeletedEvent.action = 'ignored'
    _.set(pendingDeletedEvent, [STEP_NAME, 'deletedBeforeRenamed'], event)
  }
}

/** Process an event batch. */
const step = async (
  batch /*: AtomBatch */,
  opts /*: WinIdenticalRenamingOptions */
) => {
  const {
    pouch,
    state: { [STEP_NAME]: state }
  } = opts

  for (const event of batch) {
    indexDeletedEvent(event, state)

    if (event.action === 'renamed') {
      await fixIdenticalRenamed(event, pouch)
      ignoreDeletedBeforeIdenticalRenamed(event, state)
    }
  }
}

const _loop = async (channel, out, opts) => {
  const output = pending => {
    clearTimeout(pending.timeout)
    out.push(pending.events)
    pending.deletedEventsById = new Map()
    pending.events = []
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const events = await channel.pop()
    const {
      state: { [STEP_NAME]: state }
    } = opts

    await step(events, opts)

    output(state.pending)
    rotateState(state, events)

    const { pending } = state
    pending.timeout = setTimeout(() => {
      output(pending)
    }, DELAY)
  }
}

const loop = (
  channel /*: Channel */,
  opts /*: WinIdenticalRenamingOptions */
) => {
  const out = new Channel()

  _loop(channel, out, opts).catch(err => {
    log.error({ err })
  })

  return out
}

module.exports = {
  STEP_NAME,
  initialState,
  loop,
  step
}
