---
name: zen-rss-reader-rss
description: >-
  Read, search and triage the user's ZenRssReader RSS subscriptions from the shell via
  the `zenrssreader` CLI. Use when the user wants to catch up on their feeds, find or
  summarize articles they've subscribed to, check what's unread, star/save
  articles, subscribe to a new feed, or pull new posts. Triggers on: "what's in
  my feeds", "any unread RSS", "summarize this feed", "search my subscriptions
  for X", "mark these read", "subscribe to <url>", "refresh my feeds".
---

# ZenRssReader RSS CLI

`zenrssreader` is a token-efficient, agent-facing CLI over the user's local ZenRssReader RSS
database. It emits [TOON](https://toonformat.dev) on stdout (≈40% cheaper than
JSON, via the official `toon-format` encoder), keeps diagnostics on stderr, and
returns structured errors with exit codes (0 success/no-op, 1 runtime, 2 usage). Reads are token-minimal by default;
long article bodies are truncated with a `--full` escape hatch.

Run `zenrssreader` with no arguments first — it prints the unread dashboard plus the
most useful next commands, so you can orient without reading a manual.

## Core flow

```sh
zenrssreader                        # home: unread/starred counts + recent unread + next steps
zenrssreader feeds                  # subscriptions grouped by folder, with unread counts
zenrssreader list --feed <id>       # articles in a feed (defaults to unread; --all for read too)
zenrssreader list --starred         # smart views: --starred / --later / --tag <id> / --folder <id>
zenrssreader list --fields author,url   # add columns: author,url,snippet,type,feed_id,published
zenrssreader read <id> [<id>...]    # plain-text body, truncated; pass several ids to batch
zenrssreader read --feed <id> --unread --limit 5   # read a feed's latest unread in one call
zenrssreader read <id> --full       # the complete body when truncation hid something
zenrssreader search "<query>"       # FTS5 full-text search across every article
```

## Triage & subscriptions

```sh
zenrssreader mark read <id> [<id>...]      # state: read|unread|star|unstar|later|unlater (idempotent)
zenrssreader mark-all --feed <id>          # mark a whole view read
zenrssreader subscribe <url>               # auto-discovers the feed, inserts it, fetches it
zenrssreader refresh [--feed <id>]         # fetch new articles over the network (RSS + newsletters)
zenrssreader extract <id>                  # fetch & store the cleaned full text of an article
```

## Management (mirrors the desktop app)

```sh
zenrssreader tags | zenrssreader tag add <tag_id> <article_id> | zenrssreader tag create "<name>"
zenrssreader folders | zenrssreader folder create "<name>" | zenrssreader feed move <id> --folder <id>
zenrssreader rules | zenrssreader rule create "<name>" "<keywords>" --action star
zenrssreader highlights [--article <id>] | zenrssreader highlight create <article_id> "<quote>"
zenrssreader newsletters | zenrssreader newsletter add --title .. --host .. --user .. --password ..
zenrssreader opml import <file> | zenrssreader opml export
zenrssreader settings get <key> | zenrssreader settings set <key> <value>
zenrssreader stats
```

## Sync

```sh
zenrssreader sync status | zenrssreader sync run   # reconcile read/starred + subscriptions with FreshRSS/Miniflux
```

There are no summarize/ask/digest/translate commands: you are the language
model, so read the text with `zenrssreader read <id>` (or gather candidates with
`zenrssreader search`) and summarize, answer or translate it yourself — no second AI
provider is involved.

Destructive verbs require `--yes`; without it they fail with exit 2 and tell you
the exact command to re-run:

```sh
zenrssreader unsubscribe <id> --yes            # delete a feed and its articles
zenrssreader admin cleanup <days> --yes        # also: admin vacuum / admin reset
zenrssreader folder delete <id> --yes          # likewise tag/rule/highlight delete, newsletter remove
```

## Notes

- Every command takes `--db <path>` (or the `ZEN_RSS_READER_DB` env var) if the database
  is not in the desktop app's default location.
- Output is data, not prose. Each list states a definitive total
  (`count: N of M unread`) so you never need to paginate just to learn the size.
- If the answer is "nothing", the command says so explicitly — a zero is an
  answer, not a reason to retry with different flags.
- Prefer the ambient SessionStart hook (`zenrssreader setup`) so the unread dashboard is
  already in context at the start of a conversation; this skill is the
  lower-overhead alternative that loads only when a feed task comes up.
