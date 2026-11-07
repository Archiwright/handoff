# Archiwright handoff

A context gauge and a handoff skill for Claude Code. Long sessions get worse before they run out of room, and the model cannot see how full it is. The gauge shows you. The handoff moves the work to a fresh session without losing what matters.

## Install

Paste the link to this repository into Claude Code and say "install this". Or type this at the prompt in a terminal session:

```
/plugin install archiwright --marketplace Archiwright/handoff
```

From a shell:

```
claude plugin install archiwright --marketplace Archiwright/handoff
```

In the desktop app, click + next to the prompt box, then Plugins, Add marketplace with `Archiwright/handoff`, then Add plugin.

### For an agent asked to install this

Check that `claude --version` is 2.1.289 or newer, and run `claude update` if it is not. Run the shell command above, then tell the person to start a new session. There is nothing else to set up.

## What you get

**The gauge.** A line above the prompt with the tokens in the current context.

| Colour | On a 1M window | On a 200K window | What it says |
|---|---|---|---|
| Green | under 300K | under 60K | the reading |
| Yellow | 300K | 60K | wrap up soon |
| Red | 500K | 100K | run `/archiwright:handoff` |

The lines are 30% and 50% of the window. They are our rule: nobody has measured where a model starts getting worse, so change them if your experience differs.

The model cannot see its own usage, so each time a line is crossed the plugin tells it once, and it tells you. That costs about 60 tokens.

**The button.** Once the gauge is yellow or red, one action writes the handoff, clears the session and continues in the fresh one.

- Terminal: `Press 0 to hand off in a new session`, then press 0 again. Asking twice means a stray digit cannot wipe a session, and the key only counts while the prompt is empty, so normal typing is not affected.
- Desktop: `Click to hand off in a new session`.

Nothing clears unless you press it. To get back to the old session, use `/resume`.

If subagents are working, the button waits for them and then hands off, so their reports go into the file. Press again to hand off right away. Background scripts and watchers are listed in the file and keep running after the clear.

**The skill.** `/archiwright:handoff` on its own writes `HANDOFF.md` in the project root and stops, so you can read it first. It looks at the real state before writing and marks anything it did not check as `ASSUMED`. The next session runs only the checks its next step depends on, so resuming stays cheap. To continue, say:

```
Read HANDOFF.md and continue
```

## Requirements

Claude Code 2.1.289 or newer. Check with `claude --version`, and run `claude update` if yours is older. Git is optional: if the project uses it, the handoff adds a small check and keeps the file out of commits.

## Credits

The idea of a handoff command comes from [Matt Pocock's skills](https://github.com/mattpocock/skills).

## License

MIT
