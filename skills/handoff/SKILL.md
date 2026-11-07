---
name: handoff
description: Write a checked handoff file so a fresh session can continue this work. Run it when the context gauge turns red, or before moving a task to a new session.
disable-model-invocation: true
argument-hint: "[what the next session should focus on]"
---

# Handoff

Write `.archiwright/handoffs/${CLAUDE_SESSION_ID}.md` in the project so a fresh session, knowing nothing, can continue this work. Every session has its own file, so never touch another session's. If the person passed arguments, they say what the next session will focus on: tailor the file to that.

Test every line: without it, would the next session get something wrong or redo work, and could it not find this out cheaply? If not, leave it out. There is no length limit, because a big project can need a long file, but never copy what already exists elsewhere. Point to specs, plans, issues and code by path or URL.

## 1. Check

You are probably deep into a long session, so your memory of it is the least reliable thing here. Before you write:

- Open the files you are about to mention and confirm they say what you remember.
- Re-run a test only if you are about to claim it passes and it is quick.
- Find what is still running: subagents, background shells, scripts and servers. Do not rely on memory: use a tool that lists them if you have one, such as `ListAgents`, and say so in the file if you could not check. Include only what this work started: other sessions on the machine do not belong in the file.
- If this session's file already exists, or this session started from an earlier handoff, carry forward anything still open.
- Only in a git repository, run `git branch --show-current; git rev-parse --short HEAD; git status --short | wc -l` for the "Written at" line. Nothing else here needs git.

## 2. Write the file

Start the file with this line, exactly:

```
You are continuing work from an earlier session. If this file has a "Written at" line, run `git rev-parse --short HEAD; git status --short | wc -l` and compare. Run the checks listed under Next step, nothing else. Open pointers only when the work needs them. If anything differs or fails, say so before acting. Then tell the person in two sentences where things stand and what you will do next, including anything only they can do.
```

Then these sections, in order. Leave out any that have nothing in them.

- **Written at** (git only): for example `main @ e8d8a41, 3 changed files`.
- **Waiting on the person**: a question they have not answered, or something only they can do.
- **Goal**: what the person wants, in their own words where you can quote them, including limits such as "investigate only, do not edit".
- **Decisions**: what was decided and why. Quote the person's exact rules and corrections. These exist only in the conversation.
- **Done**: one line each: what is finished, where it lives (path, URL, account or setting), and how far it was tested. Include work that git cannot show. Leave out how it was done.
- **Left**: what remains, including anything finished but untested.
- **What failed**: approaches already tried and why they did not work.
- **Running**: each subagent, background shell, script or server still going: what it is doing, its ID or process number, where its output goes, how to stop it, what to do with its result, and how to restart it if it is gone. A subagent's report can reach the new session, which will not know why unless this says so.
- **Next step**: the single next action, concrete enough to start without asking. Below it, list only the claims that action depends on, each with one quick check, such as a short command or a file to open.
- **Pointers**: paths, URLs and commits, plus any skills the next session should load.

Mark any claim you did not just look at as `ASSUMED`, so the next session knows what it is relying on. It only checks the ones under Next step.

Never write API keys, passwords, tokens or personal data into the file.

## 3. Keep it out of git

Only in a git repository: add `.archiwright/` to the file that `git rev-parse --git-path info/exclude` names, if it is not already covered, so handoffs cannot be committed by accident. This changes no tracked file. Leave `.gitignore` alone.

## 4. Tell the person

Say in one or two lines that it is saved and what you could not check. Unless you were told this session clears itself, then add: if it does not clear by itself, run `/clear` in this window and say `Read .archiwright/handoffs/${CLAUDE_SESSION_ID}.md and continue`, because exiting stops anything still running.
