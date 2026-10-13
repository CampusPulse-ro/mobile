# Working with AI on CampusPulse

The goal: let AI do the typing while you still understand everything you commit. If you can't
explain a line in your PR, it isn't ready yet.

## 1. Give the AI the context first

An AI only knows what it can see. How you show it the project depends on the tool:

- **A chat in the browser** (ChatGPT, Claude, Gemini…): at the start of **every new chat**, upload or
  paste [`ai-context.md`](ai-context.md), then the files you're working on. Without that it guesses
  at our structure and rules, and the guesses are often wrong.
- **An AI inside your editor that can open files itself** (VS Code with Copilot, Cursor…): most of
  them read `AGENTS.md` automatically. If yours doesn't, start with "Read `docs/ai-context.md` and
  `CONTRIBUTING.md` first."

## 2. The loop for every change

1. **Start from the issue:** paste its text (goal, context, acceptance criteria) after
   ai-context.md; it's the clearest description of the task you have. Then say what you want
   in plain words, plus which screen or file: "On the Timetable tab, show today's classes as a list" beats
   "make the timetable".
2. **Ask for a plan before code:** "Before writing code, explain how you would do it and which
   files change." Fix the plan if it's wrong; that's much cheaper than fixing code.
3. **Ask for one small step** at a time.
4. **Read what it wrote.** Any line you don't understand: "Explain this line."
5. **Run it on your phone.** Check the loading, error and empty states too, not just the happy case.
6. **Commit, then the next step.** Small commits mean you can always go back.

## 3. Prompts that work

**A new screen**

> I'm adding [what] to [screen]. Here is the current file: [paste]. Follow the patterns in
> `src/components/ui.tsx` and the rules in ai-context.md. Plan first, then code.

**A bug**

> I did [steps], expected [X], got [Y]. Exact error: [paste the whole message]. File: [paste].
> Explain the cause before you fix it.

**Understanding code**

> Explain what this file does, step by step, for a beginner: [paste].

**A review before your PR**

> Here is my change: [paste the diff]. Check it against the rules in ai-context.md. What is wrong,
> risky or unclear?

## 4. Signs the AI is wrong

- It imports a package that isn't in `package.json`, or a function you can't find anywhere.
- It writes colors or URLs directly in a screen.
- It "fixes" an error by deleting a check, adding `any` or `@ts-ignore`, or turning off a lint rule.
- It rewrites files you didn't ask about.
- It says "this should work" without telling you how to check it.

When that happens, say what's wrong and ask again. Don't paste its code in and hope.

## 5. Never paste into an AI

- Passwords, tokens, API keys or `.env` files.
- **Campus Virtual tokens** above all: one gives full access to that student's university account.
- Other students' data (names, grades, timetables from real accounts).

## 6. Ask Sebastian when

- you need something from the backend (a new field, a new endpoint);
- you think a new package is needed;
- it touches login, tokens, `app.json`, the build or CI;
- you've been stuck for more than about 30 minutes. That's normal, not a failure.

## 7. Before you open the PR

- [ ] `bun run format`, then `bun run lint` and `bun run typecheck` pass
- [ ] you ran it on the phone and looked at every screen you touched
- [ ] loading, error and empty states checked
- [ ] you can explain every line of the diff
- [ ] the PR description says what, why and how you tested it, with a screenshot

Workflow and code standards: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
