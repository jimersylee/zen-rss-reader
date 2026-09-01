<div align="center">

<img src="docs/logo.svg" alt="ZenRssReader" width="96" height="96" />

# ZenRssReader

**A fast, native RSS reader — and a CLI your AI agent can actually drive.**

<img src="docs/screenshot.webp" alt="ZenRssReader" width="820" />

</div>

ZenRssReader is two front-ends over **one local database**:

- **A desktop reader** — fast, native, offline-first. No account, no cloud.
- **`zenrssreader`, an agent-facing CLI** — so an autonomous agent (Claude Code, Codex,
  OpenCode…) can read, search and triage your feeds straight from the shell.
  [Jump to it ↓](#zenrssreader--your-feeds-handed-to-your-agent)

Both read the same database through the shared `zen-rss-reader-core` crate, so the app and
the CLI can never drift apart.

---

## The desktop app

- **Feeds & folders** — subscribe, organize, and import/export OPML.
- **Smart views** — All, Unread, Starred, and Read Later, with live counts.
- **Tags & rules** — color-coded tags and rules that tag new articles automatically.
- **Full-text** — fetch and clean the complete article when a feed ships only a summary.
- **AI** — summaries, ask-the-article Q&A, and digests. Bring your own API key.
- **Audio** — a built-in player that follows you from article to article.
- **FreshRSS sync** — keep read state in step with a FreshRSS server.
- **Local-first** — everything stays on your machine. No account, no cloud.
- **Localized** — English, Japanese, and Simplified Chinese.

### Install

| Platform | How |
| --- | --- |
| **macOS** | `brew install --cask jimersylee/zenrssreader/zenrssreader` — or grab the `.dmg` |
| **Windows** | Download the `.msi` installer |
| **Linux** | Download the `.AppImage` or `.deb` |

All packages live on the **[latest release](https://github.com/jimersylee/zenrssreader/releases/latest)**.
The macOS builds are Developer ID signed and notarized.

---

## `zenrssreader` — your feeds, handed to your agent

This is what makes ZenRssReader different. `zenrssreader` is a command-line companion built **for
autonomous agents** to drive over the shell. Point your agent at it and it can
work your feeds with no GUI:

- **Read** — `feeds`, `list`, `read`, full-text `search`
- **Triage** — `mark` read/star/later, `extract` full text, `refresh`
- **Manage** — subscriptions, folders, tags, rules, highlights, OPML
- **Sync** — FreshRSS / Miniflux

Run bare `zenrssreader` and it prints your unread dashboard *plus the next useful
commands*, so the agent orients with zero manual. Output is
[TOON](https://toonformat.dev) — ~40% fewer tokens than JSON — with definitive
counts and structured exit codes.

```console
$ zenrssreader
unread: 206   starred: 17   later: 0   feeds: 15
articles[10]{id,feed,title,flags,date}:
  3664,V2EX,[Java] 使用 kkRepo 搭建 Maven 私服,unread.star,"2026-06-25"
  ...
help[4]: Run `zenrssreader read <id>` to read an article's full text, ...
```

### Hand it to your agent — one line

The bundled **[`zen-rss-reader-rss` skill](skills/zen-rss-reader-rss/SKILL.md)** loads *on demand*
when an agent recognizes a feed-related task, so it costs nothing until you use
it. Install it with [`skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add https://github.com/jimersylee/zenrssreader/tree/main/skills/zen-rss-reader-rss
```

Want the agent *proactively* aware of your feeds every conversation? `zenrssreader setup`
wires up an ambient SessionStart hook (Claude Code, Codex, OpenCode).

### Install the CLI

| Platform | How |
| --- | --- |
| **macOS / Linux** | `brew install jimersylee/zenrssreader/zen-rss-reader-cli` |
| **Windows** | Download `zenrssreader-x86_64-pc-windows-msvc.zip`, unzip, drop `zenrssreader.exe` on your `PATH` |
| **Any** | Prebuilt `zenrssreader-<target>.tar.gz` from the [latest release](https://github.com/jimersylee/zenrssreader/releases/latest), or `cargo build --release -p zen-rss-reader-cli` |

> **Full command reference, agent setup, and install options → [docs/cli.md](docs/cli.md)**
