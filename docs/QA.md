# QA checklist

## Session restore

- Corrupt `activeTabId` in session.json falls back to first tab (no blank screen).
- Scrollback loads before live PTY output is flushed to xterm.

## File explorer

- `cd` in terminal updates tree within ~1s (watcher restart).
- Toggle hidden folders refreshes expanded subtrees.
- Drag-move updates open editor path.
- Enter opens files when open-on-double-click mode is enabled.

## AI agent

- Chat resets when switching terminal panes.
- `@mentions` appear in system context.
- Write guard blocks unrequested file paths.
- Agent loop stops after 10 iterations.

## Terminal tabs

- Inactive tabs unmount xterm (max 2 mounted); switching back refits panes.
- Busy indicator clears on process exit, not after 350ms silence.
