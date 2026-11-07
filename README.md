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
| Green | under 500K | under 100K | the reading |
| Yellow | 500K | 100K | wrap up soon |
| Red | 700K | 140K | run `/archiwright:handoff` |

The lines are 50% and 70% of the window. They are our rule: nobody has measured where a model starts getting worse, so change them if your experience differs.

The model cannot see its own usage, so each time a line is crossed the plugin tells it once, and it tells you. That costs about 60 tokens.

**The button.** Once the gauge is yellow or red, one action writes the handoff, clears the session and continues in the fresh one.

- Terminal: `Press 0 to hand off in a new session`, then press 0 again. Asking twice means a stray digit cannot wipe a session, and the key only counts while the prompt is empty, so normal typing is not affected.
- Desktop: `Click to hand off in a new session`.

Nothing clears unless you press it. To get back to the old session, use `/resume`.

If subagents are working, the button waits for them and then hands off, so their reports go into the file. Press again to hand off right away. Background scripts and watchers are listed in the file and keep running after the clear.

**The command.** `/archiwright:handoff` does the same as the button, at any time, and anything you type after it tells the next session what to focus on. It looks at the real state before writing the handoff to `.archiwright/handoffs/`, with one file per session so sessions in the same project never overwrite each other. It marks anything it did not check as `ASSUMED`, then clears and continues by itself. The next session runs only the checks its next step depends on, so resuming stays cheap. If subagents are working it waits for them first, and running the command again hands off right away.

## Requirements

Claude Code 2.1.289 or newer. Check with `claude --version`, and run `claude update` if yours is older. Git is optional: if the project uses it, the handoff adds a small check and keeps the file out of commits.

## Credits

The idea of a handoff command comes from [Matt Pocock's skills](https://github.com/mattpocock/skills).

## License

MIT
