# TSUNAGI///Matrix — Claude plugin

The TSUNAGI///M tools for the BMW E46 M3, in Claude: the public calculations on the owner's own files, and, for owners with WORKS, TUNER WORKS while it logs the car. How to install it, for people and for the assistant doing it, is in [INSTALL.md](../INSTALL.md).

| | What | Who | Works in |
|---|---|---|---|
| `matrix-mapping` | Local MCP server: MAPPING's public tools. TUNER's calculations on a BIN and a drive log (`read_bin`, `read_log`, `propose_ve`, `propose_rfkorr`), and SMG II decoding (`smg2_image`, `smg2_read`, `smg2_compare`). Reads files on this computer, sends nothing | Anyone | Claude Code |
| `matrix-migration` | Local MCP server: MIGRATION's public tools, read only. DME backups (`boot_backup`, `boot_compare`) and cluster M35080 dumps (`m35080_read`, `m35080_compare`). Never prints the VIN | Anyone | Claude Code |
| `tuner-works` | Remote MCP connector to MAPPING's WORKS relay (`https://matrix-mcp.tsunagi.app/mcp/mapping/works`), beside the public `/mcp/mapping` on the same host. Sign-in is on m3, with an account that holds WORKS. Twenty-six tools: the drive procedure (`tuner_guide`), status, the log around a moment (or an earlier run), the whole run and the whole VE map in one answer each, start and stop a log, bring a view to the front, the session's CO-WORK record (read it, write the plan, mark its steps in any order, choose what the screen shows the driver, keep the driver's words, record findings, questions and answers), mark the log, list the saved sessions, open, start and copy one, drop unsaved edits, look RAM up for an observation run, read the open BIN's calibration with the evidence for what a value means, known recipes compared with the open BIN, stage a change on its CALIBRATION tab, SAVE, send to the cloud and bring a session back (a person writes to the car) | MILE purchasers and approved installer owners | claude.ai web and mobile chat, Claude Code |
| `monitoring-works` | Remote MCP connector to MONITORING's WORKS relay (`https://matrix-mcp.tsunagi.app/mcp/monitoring/works`). Sign-in is on m3, with an account that holds WORKS. The tools are the ones the open MONITORING WORKS tab declares (`monitoring_*`, with `monitoring_guide` answered by the relay): status, fault memories, what each module can be sent and why not, an investigation the owner hands over and its CO-WORK record (the mandate, plans of reads, findings, questions, the owner's words), the moment and the PROBE run, the verification ledger, the screen and a procedure put on it, recording, SAVE and SYNC. Reads only reach the car, through the tab's gate; tests, adjustments, fault clears and writes stay with a person on the screen | MILE purchasers and approved installer owners | claude.ai web and mobile chat, Claude Code |
| `matrix-public` | Skill: the way in to the public tools. It sends the assistant to `about_matrix`, whose `howToUse` is the procedure (which tool for which question, how to take the owner's files, what to relay, that writing to the car happens in the apps), and keeps only the rules for when that cannot be read | Anyone | everywhere |
| `tuner-drive` | Skill: the way in to talking with a driver by voice while TUNER WORKS logs. It sends the assistant to `tuner_guide`, which holds the procedure by topic (the log and the moment, the whole run and VE map, CO-WORK, sessions, calibration, saving and syncing, observation runs, a silent tab), and keeps only the rules for when that cannot be read | WORKS | everywhere |
| `monitoring-drive` | Skill: the way in to talking with an owner by voice while MONITORING WORKS reads the car. It sends the assistant to `monitoring_guide`, which the tab declares and the relay keeps — the diagnostic cycle and its topics (faults, investigating a symptom, the catalogue, CO-WORK, the moment, the overview, procedures on the screen, tuning, saving, trouble, autonomy) — and keeps only the rules for when that cannot be read | WORKS | everywhere |

Nothing here can connect to the car, write to it or flash it. A person does that on the screen. There is no tool for it.

## How the local servers start

`.mcp.json` starts both local servers with `node servers/matrix-mcp.mjs <category>`, which asks npm for the newest matrix-tsunagi and runs `npx --prefix <tmp> -y matrix-tsunagi@<that version> mcp <category>`:

- **`node`, not `npx`, in `.mcp.json`:** one file serves every OS, and Claude Code on native Windows cannot start `npx` itself (it is `npx.cmd`).
- **The newest published version, at every start (2026-10-23):** a release on npm reaches owners without a new plugin. What reaches them is still what the operator publishes. Offline, npm's cache answers with the newest version it holds (`--prefer-offline … @latest`).
- **`--prefix <tmp>`:** inside a checkout of this repository, npm would take the checkout for the package and fail. The server still runs in the owner's working directory, so relative file paths keep their meaning.
- claude.ai ignores local servers, so the public tools run in Claude Code only. On the phone, the WORKS part works.

Checked on Windows 11 on 2026-10-20: both servers start, list their tools and answer, and stop when Claude Code closes them. `claude --plugin-dir ./plugin mcp list` shows them Connected and `tuner-works` waiting for sign-in.

## What lives where

- **The Skills are only the way in,** and should not need to change: read the procedure from the server, and a few rules for when it cannot be read. An uploaded Skill stays as it was until the owner uploads another — 0.7.0 of the relay dropped `tuner_observe` while a 0.3.6 Skill still told the assistant to use it.
- **The procedure changes with the tools, so it is published with them:** `tuner_guide` on the relay (`bridge/src/guide.ts`, new on a reconnect), `monitoring_guide` from the MONITORING WORKS tab itself (its `public/guide/`, declared in its hello and kept by the relay), and `about_matrix`'s `howToUse` on the public servers (`src/guide.ts`, new on the next start after an npm release).
- **Facts change with the tools' code:** what each column means, how to read the knock counters, why samples were left out, what each tool returns. They come from the servers' instructions (`src/mcp.ts`, `bridge/src/mcp.ts`), the tools' descriptions and the answers, never from a copy here. A copy here would go stale with the next release.

## Changing it

1. A procedure changes in `bridge/src/guide.ts` or `src/guide.ts`, not here — it then reaches owners without this plugin. Edit the Skills, `.mcp.json` or `servers/matrix-mcp.mjs` only when the way in itself changes.
2. Bump `version` in `.claude-plugin/plugin.json`.
3. Check with `claude plugin validate ./plugin` and `claude plugin validate .` (the marketplace), and load it once with `claude --plugin-dir ./plugin mcp list`.
4. Run `npm run plugin:pack` for a ZIP. Installing from GitHub needs the change on `main`.

## 日本語

BMW E46 M3 の TSUNAGI///M のツールを Claude で使うためのプラグインです。入れ方は [INSTALL.md](../INSTALL.md) にあります。

- **パブリック**（誰でも、サインイン不要）：`matrix-mapping` と `matrix-migration` が、PC の上でオーナーのファイルを読んで計算します。どこにも送りません。動くのは Claude Code です。手順はサーバー（`about_matrix` の `howToUse`）が持ち、Skill `matrix-public` はその入口です。npm に新しい版が出ると、次に起動したときから新しい手順になります。
- **WORKS**（MILE をご購入いただいた方と施工オーナーさん）：`tuner-works` が、開いている TUNER WORKS を操作します（キャリブレーションの変更、SAVE、クラウドへの送信と取り込みは、オーナーが声で確認したときだけ。車への書き込みはオーナーが画面で行います）。`monitoring-works` は、開いている MONITORING WORKS に故障や読み取りを訊き、任された調査の計画と所見を CO-WORK に書きます（車に送るのは読み取りだけで、送ってよいかはタブが決めます。作動テスト・調整・故障消去は画面で人が行います）。サインインは m3 で行います。スマホのアプリでも使えます。運転中の手順は `tuner_guide` と `monitoring_guide` が持ち、Skill `tuner-drive` と `monitoring-drive` はその入口です。手順は、つなぎ直すだけで新しくなります。

車への接続と書き込みは、画面で人が行います。
