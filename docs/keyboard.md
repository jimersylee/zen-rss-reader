# Keyboard-only controls

The app combines existing reading shortcuts with screen-local letter hints.
It does not require a permanent, conflicting key binding for every button.

## Quick start

| Keys                             | Action                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `;`                              | Label the current screen's visible controls; type a full label to operate one |
| `Cmd/Ctrl + Shift + ;`           | Open hints even while a text field has focus                                  |
| `Esc`                            | Exit hints without dismissing the underlying menu/dialog                      |
| `Backspace`                      | Remove the last typed hint letter                                             |
| `F6` / `Shift + F6`              | Cycle focus through sidebar, article list, reader and open AI pane            |
| `Shift + F10` / Context Menu key | Open the focused feed, folder, tag, article or reader context menu            |
| `Tab` / `Shift + Tab`            | Move between controls; dialogs contain focus                                  |
| `Enter` / `Space`                | Activate a focused button or article row                                      |
| `Cmd/Ctrl + Shift + F6`          | Return from an embedded original-page WebView to app controls and open hints  |

On Mac, function keys may additionally require `Fn`. The native **Keyboard →
Return to App Controls** menu exposes the return shortcut without giving remote
web pages access to the app's backend.

All existing shortcuts remain: `J/K`, `S`, `B`, `U`, `O`, `I`, `F`, `V`,
`Shift+A`, `Shift+D`, `Cmd/Ctrl+K`, `Cmd/Ctrl+,` and `Cmd/Ctrl+R`.
Plain-letter shortcuts are suppressed in editable controls and during IME
composition; modifier shortcuts retain their existing application scope.

## How hints work

- Hints target buttons, links, interactive rows, form controls, resize handles,
  scroll panes, existing highlights, reader images, media and embedded frames.
- Only currently visible, enabled controls are labelled. Scroll the relevant
  pane and reopen hints to reach more controls, including virtualized rows.
- Labels are temporary and screen-local, not fixed bindings. Screens with many
  controls use equally long labels so a short label cannot accidentally trigger
  before a longer one is complete.
- A topmost dialog, confirmation or menu restricts hints to its own controls.
- Text fields, selects, sliders, scroll panes, images and media receive focus
  rather than a synthetic value change. Continue with native keyboard controls;
  `Shift+F10` opens the reader's image menu when an image has focus.
- Buttons reuse their original click handlers. Delete confirmations and Undo
  windows are not bypassed by keyboard activation.
- Scrolling, pointer input, window blur or relevant UI mutations cancel hints
  rather than allowing an old label to activate a recycled/changed control.
- After a dialog closes, focus returns to its trigger where that element still
  exists. `Esc` also leaves a main-screen input to resume reading shortcuts.

## Examples

**Manage a subscription:** use hints to focus/select its sidebar row, press
`Shift+F10`, then use menu arrow keys or a fresh set of hints to rename, move,
refresh or unsubscribe.

**Change a setting:** `Cmd/Ctrl+,`, then `;`, type the settings-section label,
open hints again and choose the setting. For a select or slider, finish with
arrow keys. Press `Esc` to close Settings.

**Open a low-frequency reader action:** `J` opens an article; `;` exposes toolbar
buttons such as full text, tags, translation and sharing without extra fixed
shortcuts.

## Boundaries and verification

External web pages, operating-system file dialogs, and native media controls
keep their own keyboard behavior. Hints do not inspect cross-origin iframe or
native child-WebView documents. Use the native return shortcut to reach app
controls again. Arbitrary article text selection is not assigned a custom
shortcut; the highlight toolbar supports keyboard-completed selections where
the webview allows them, and existing highlights are hint targets.

Automated frontend interaction checks use a browser with mocked Tauri IPC and
synthetic fixtures, not the user's actual database. Native accelerator routing
and focus transfer still need a real desktop-app check; a Rust compilation/test
pass is not a substitute for that manual check.
