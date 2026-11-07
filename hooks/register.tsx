import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Level, Reading } from '../types'

// Shares of the context window. On a 1M window: 500K and 700K.
const YELLOW_AT = 0.5
const RED_AT = 0.7

const COMMAND = '/archiwright:handoff'
const NAME = COMMAND.slice(1)
const FOLDER = '.archiwright/handoffs'

const reading = atom({ plugin: 'archiwright', key: 'reading' } as const, null)
const told = atom({ plugin: 'archiwright', key: 'told' } as const, 'green')
const ready = atom({ plugin: 'archiwright', key: 'ready' } as const, false)
const armed = atom({ plugin: 'archiwright', key: 'armed' } as const, false)
const pendingSince = atom({ plugin: 'archiwright', key: 'pendingSince' } as const, null)
const waiting = atom({ plugin: 'archiwright', key: 'waiting' } as const, false)
const agentCount = atom({ plugin: 'archiwright', key: 'agentCount' } as const, 0)
const skillStarted = atom({ plugin: 'archiwright', key: 'skillStarted' } as const, false)
const focus = atom({ plugin: 'archiwright', key: 'focus' } as const, '')

const RANK: Record<Level, number> = { green: 0, yellow: 1, red: 2 }

const UNFINISHED = ['pending', 'running', 'waiting']
const PERSON = ['composer', 'bridge', 'sdk']

const levelOf = (tokens: number, window: number): Level => {
  if (tokens >= window * RED_AT) return 'red'
  if (tokens >= window * YELLOW_AT) return 'yellow'
  return 'green'
}

const chainNote = (path: string) =>
  `Write the handoff to exactly ${path}. This session clears itself as soon as you finish. End with one short line, and do not tell the person to read the file, clear or start a new session.`

const short = (tokens: number) => `${Math.round(tokens / 1000)}K`

const advice = (r: Reading) => {
  if (r.level === 'red') return `${short(r.tokens)} context: run ${COMMAND}`
  if (r.level === 'yellow') return `${short(r.tokens)} context: wrap up soon`
  return `${short(r.tokens)} context`
}

// One file per session, so sessions in the same project cannot touch each other's work.
async function handoffPath($: EngineInterface) {
  return `${FOLDER}/${await $.session.id()}.md`
}

async function refresh($: EngineInterface) {
  const usage = await $.session.usage()
  const { context } = usage
  const now: Reading | null = context.tokens
    ? { tokens: context.tokens, window: context.window, level: levelOf(context.tokens, context.window) }
    : null
  await update($, reading, () => now)

  // VS Code has no band above the prompt, so it gets the status line instead.
  const surfaces = await $.session.surfaces()
  $.ui.status(surfaces.includes('vscode') && now ? advice(now) : undefined)

  // Going down (after a compact or a clear) means the next crossing is news again.
  const level = now?.level ?? 'green'
  if (RANK[level] < RANK[await read($, told)]) await update($, told, () => level)

  // A handoff written by this session can be picked up. A clear starts a new session id, so this resets itself.
  const written = await $.fs.stat(await handoffPath($)).catch(() => null)
  const isReady = written !== null
  await update($, ready, () => isReady)
  if (await read($, waiting)) {
    const count = await unfinishedAgents($)
    await update($, agentCount, () => count)
  }
}

async function unfinishedAgents($: EngineInterface) {
  const agents = await $.agent.list()
  return agents.filter(agent => UNFINISHED.includes(agent.status)).length
}

// Runs only from a person's click, key press or typed command. Not awaited: the calls queue until the session is idle.
async function clearAndContinue($: EngineInterface) {
  const message = await read($, focus)
  await update($, focus, () => '')
  const pickup = `Read ${await handoffPath($)} and continue`
  const text = message ? `${pickup}. User handoff message: ${message}` : pickup
  $.ui.toast('Clearing, then continuing')
  void $.command
    .run({ command: 'clear' })
    .then(() => $.prompt.submit({ text }))
    .catch((error: Error) => $.ui.toast(`Could not clear: ${error.message}`))
}

// Write the file, then clear. The clear waits for proof the file was written (see turn.complete).
async function writeThenClear($: EngineInterface) {
  const now = await $.clock.now()
  await update($, pendingSince, () => now)
  await update($, skillStarted, () => false)
  $.ui.toast('Writing the handoff, then clearing')
  const args = await read($, focus)
  void $.command
    .run({ command: NAME, args })
    .catch((error: Error) => $.ui.toast(`Could not run the handoff: ${error.message}`))
}

// One action: write the handoff, clear, continue. A subagent that pauses across a clear can lose its task, so finish them first.
async function handOff($: EngineInterface) {
  const count = await unfinishedAgents($)
  if (count > 0) {
    await update($, agentCount, () => count)
    await update($, waiting, () => true)
    return
  }
  if (await read($, ready)) {
    await clearAndContinue($)
    return
  }
  await writeThenClear($)
}

// A stray digit must not wipe a session, so the keyboard asks twice. A click is deliberate enough.
// While waiting, one press hands off anyway, so a stuck subagent cannot block the person.
async function press($: EngineInterface, surface: string) {
  if (await read($, waiting)) {
    await update($, waiting, () => false)
    await writeThenClear($)
    return
  }
  if (surface !== 'terminal' || (await read($, armed))) {
    await update($, armed, () => false)
    await handOff($)
    return
  }
  await update($, armed, () => true)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    if (e.agentId !== undefined) return result
    await update($, armed, () => false)

    // A finished subagent's report starts a main turn, so by here it is in the conversation. Write a fresh file that includes it.
    if ((await read($, waiting)) && (await unfinishedAgents($)) === 0) {
      await update($, waiting, () => false)
      await writeThenClear($)
      return result
    }

    // Clear once the skill has finished or the file is newer than the request. The skill may keep a file that is still right.
    const since = await read($, pendingSince)
    if (since !== null) {
      const written = await $.fs.stat(await handoffPath($)).catch(() => null)
      const isNewer = written !== null && written.mtimeMs >= since
      if (isNewer || (await read($, skillStarted))) {
        await update($, pendingSince, () => null)
        await update($, skillStarted, () => false)
        if (written !== null) await clearAndContinue($)
        else $.ui.toast('The handoff was not written, so the session was not cleared')
      }
    }
    return result
  })

  // A long turn fills the window between prompts, so keep the gauge moving.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // The model cannot see its own usage. Tell it once per line crossed, so it can tell the person.
  on('prompt.submit', async ($, e, next) => {
    if (e.command?.name === NAME) {
      // Typed by a person: the same one action as the button. Typing it again while waiting hands off now.
      if ((await read($, pendingSince)) === null) {
        const args = e.command.args
        const isWaiting = await read($, waiting)
        if (args || !isWaiting) await update($, focus, () => args)
        const count = await unfinishedAgents($)
        if (count > 0 && !isWaiting) {
          await update($, agentCount, () => count)
          await update($, waiting, () => true)
          // Refused here, so nothing depends on the model: no turn runs until the subagents finish.
          return { drop: 'Handoff queued. It starts by itself when the subagents finish.' }
        }
        const now = await $.clock.now()
        await update($, waiting, () => false)
        await update($, pendingSince, () => now)
      }
      await update($, skillStarted, () => true)
      return next({ ...e, context: [...(e.context ?? []), chainNote(await handoffPath($))] })
    }
    if (e.command || e.isMeta) return next(e)

    // Subagent reports and notifications also arrive as prompts. Only a person's prompt cancels a handoff.
    if (PERSON.includes(e.origin?.kind)) {
      await update($, pendingSince, () => null)
      await update($, waiting, () => false)
      await update($, armed, () => false)
      await update($, focus, () => '')
    }
    await refresh($)
    const now = await read($, reading)
    if (!now || RANK[now.level] <= RANK[await read($, told)]) return next(e)

    await update($, told, () => now.level)
    const note =
      now.level === 'red'
        ? `The context gauge reads ${short(now.tokens)} tokens, past the red line. Tell the person this once, in one short sentence at the start of your reply, and suggest they run ${COMMAND} before starting anything new.`
        : `The context gauge reads ${short(now.tokens)} tokens, past the yellow line. Tell the person this once, in one short sentence at the start of your reply, and suggest they finish the current task and then run ${COMMAND}.`

    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reading)
    if (!r || e.props.hasSurvey) return next(e)

    const hasFile = await read($, ready)
    const isArmed = await read($, armed)
    const isBusy = (await read($, pendingSince)) !== null
    const isWaiting = await read($, waiting)
    const agents = await read($, agentCount)
    const onTerminal = e.surface === 'terminal'
    const { Box, Button, Text } = $.ui.resolve(e)
    const color = r.level === 'red' ? 'error' : r.level === 'yellow' ? 'warning' : 'success'

    const action = hasFile ? 'continue in a new session' : 'hand off in a new session'
    const label = isWaiting
      ? `${onTerminal ? 'Press 0' : 'Click'} to hand off now`
      : !onTerminal
        ? `Click to ${action}`
        : isArmed
          ? `Press 0 again to ${action}`
          : `Press 0 to ${action}`

    return (
      <Box flexDirection="row" gap={2}>
        <Text color={color} bold={r.level !== 'green'}>
          ● {advice(r)}
        </Text>
        {isWaiting ? (
          <Text color="warning">
            Waiting for {agents} {agents === 1 ? 'agent' : 'agents'}, then handing off
          </Text>
        ) : null}
        {(r.level !== 'green' || hasFile || isWaiting) && !isBusy ? (
          <Button
            key="handoff"
            label={label}
            {...(onTerminal ? { hotkey: '0' } : {})}
            variant="primary"
            onPress={p => press($, p.surface)}
          />
        ) : null}
      </Box>
    )
  })
}
