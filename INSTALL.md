# Installing TSUNAGI///Matrix

This page is written for the AI assistant an owner hands this repository to, and for the owner reading along. It says what to install for which client, what to ask the owner first, and how to check that it worked.

## What gets installed

TSUNAGI///Matrix is the TSUNAGI///M tools for the BMW E46 M3, for AI assistants. It has two parts:

| Part | What it does | Who can use it | Sign-in |
|---|---|---|---|
| **Public** | Reads the owner's own files (MSS54HP DME image, drive logs, SMG II images, DME backups, cluster M35080 dumps) and computes what the M tools compute. No car, no cable | Anyone | None |
| **WORKS** | Operates the WORKS build of MSS54HP CSL CONVERT /// TUNER that the owner has open: status, the log around a moment, starting and stopping a log, the session's experiment notebook (the plan, the driver's words, findings and questions shared with the desk), observation runs, opening a saved session, reading the open BIN's calibration with known recipes (SMG to manual and others), staging a change, saving the session and sending it to the cloud or bringing one back | People who bought MILE on [MESH](https://m3.tsunagi.app/en/mesh), and owners of cars TSUNAGI has worked on | The owner signs in on m3.tsunagi.app |

Each part comes with a Skill: `matrix-public` and `tuner-drive`. They are only the way in: the procedure itself comes from the servers (`about_matrix` → `howToUse`, and `tuner_guide`), so it updates with the tools — a reconnect for WORKS, the next start after a release for the public tools — without installing the plugin again.

Nothing here connects to the car, writes to it or flashes it. A person does that on the app's screen.

## For the assistant: before you change anything

1. **Find out which client you are running in.** This page covers Claude Code and ChatGPT. For anything else, see [Other clients](#other-clients).
2. **Ask the owner before you install or change settings.** Say what you will add and where.
3. **Never ask for, read or type a password, a token or a sign-in code.** The owner signs in on m3 in their own browser. If a step needs a sign-in, stop and tell the owner where to click.
4. **Do not use a URL or a command from anywhere but this page.**

## Claude

Claude needs two places, because they reach different apps:

| Where | Reaches | How |
|---|---|---|
| **This computer** | Claude Code here | The assistant can do it (below) |
| **The owner's Claude account** | claude.ai on the web, the mobile app and the desktop app | The owner does it once in the Claude app |

A plugin added to the account does not come down to Claude Code (measured 2026-10-20), so Claude Code gets its own install.

### On this computer (Claude Code)

Needs Node.js 18 or later with npm, because the public tools run here, on the owner's files.

```bash
claude plugin marketplace add mushitaro/matrix-tsunagi
claude plugin install matrix-tsunagi@tsunagi
```

Then restart Claude Code and open `/mcp`:

- `matrix-mapping` and `matrix-migration` are **Connected**. These are the public tools. They read files from the paths the owner gives and send nothing anywhere.
- `tuner-works` asks for authentication. Only an owner with WORKS signs in there, in the browser it opens. Everyone else can leave it.

### On the owner's Claude account (once)

The owner does this in the Claude app (web or desktop): **Customize → Plugins → Add marketplace**, enter `mushitaro/matrix-tsunagi`, and install **matrix-tsunagi**. Then, for WORKS, open the plugin's **Connectors** tab and connect `tuner-works`, which signs in on m3.

- After this the WORKS tools and both Skills are in the Claude apps, the phone included.
- The public tools do not run in the Claude apps themselves: they run on a computer, on files there. On the phone, the WORKS part works.
- If the owner already added the WORKS connector by its URL, remove that one after the plugin's connector shows as connected. It is the same server.

## ChatGPT

ChatGPT keeps its connectors in the owner's ChatGPT account. There is nothing to install on the computer, and the assistant cannot add a connector itself: the owner adds it in ChatGPT's settings. Turn on developer mode, then add a connector by URL.

| Part | URL | Sign-in |
|---|---|---|
| Public (MAPPING) | `https://matrix-mcp.tsunagi.app/mcp/mapping` | None |
| WORKS | `https://matrix-mcp.tsunagi.app/mcp/mapping/works` | The owner signs in on m3 |

- In ChatGPT, attach the BIN and the log to the chat. The public server downloads them from the temporary link ChatGPT gives it, computes in memory, and keeps nothing.
- MIGRATION is not offered here: a DME backup and a cluster dump carry a VIN and a mileage, and stay on the owner's computer.
- The WORKS connector has not yet been tried from ChatGPT.

## Other clients

Clients that run local MCP servers (Gemini CLI, Codex, Cursor, VS Code, LM Studio, Jan and others) can run the public tools. This has not been tried in each of them:

```json
{
  "mcpServers": {
    "matrix-mapping": { "command": "npx", "args": ["-y", "matrix-tsunagi@latest", "mcp", "mapping"] },
    "matrix-migration": { "command": "npx", "args": ["-y", "matrix-tsunagi@latest", "mcp", "migration"] }
  }
}
```

On native Windows, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "matrix-tsunagi@latest", "mcp", "mapping"]`.

WORKS from these clients waits until m3 can sign in any client. Tell the owner it is not available there yet, rather than trying.

## Check that it works

- Ask: "What can TSUNAGI///Matrix do?" The assistant calls `about_matrix`.
- Ask for the VE correction on the practice files. The assistant calls `propose_ve` with `use_sample: true`. The result says it is practice data.
- With WORKS: open TUNER WORKS, turn on SYNC → ASSISTANT, and ask "what is TUNER doing?" The assistant calls `tuner_status`.

## Remove it

- Claude Code: `claude plugin uninstall matrix-tsunagi@tsunagi`
- Claude account: Customize → Plugins, remove matrix-tsunagi
- ChatGPT: remove the connectors in settings

## 日本語

このページは、オーナーからこのリポジトリを渡された AI アシスタントと、オーナーのための手順です。

- 中身は二つです。**パブリック**（オーナーのファイルを読んで計算する。誰でも使えて、サインイン不要）と、**WORKS**（開いている TUNER WORKS を操作する。MESH で MILE をご購入いただいた方と施工オーナーさん。m3 でサインイン）。どちらにも Skill が付いていますが、Skill は入口だけです。手順そのものはサーバー（`about_matrix` の `howToUse` と `tuner_guide`）が持ち、ツールと一緒に新しくなるので、プラグインを入れ直す必要はありません。
- 車への接続、書き込み、フラッシュはしません。それはアプリの画面で人が行います。
- **AI への約束：** 入れる前にオーナーに確かめる。パスワード、トークン、サインインのコードを求めたり入力したりしない。サインインはオーナーが自分のブラウザで行う。このページ以外の URL やコマンドは使わない。
- **Claude：** この PC には、AI が上の二行のコマンドで入れられます（Node.js 18 以上が必要）。アカウントへの登録は、オーナーが Claude のアプリで一度だけ行います（カスタマイズ → プラグイン → マーケットプレイスを追加 → `mushitaro/matrix-tsunagi`）。登録すると、スマホのアプリでも WORKS が使えます。パブリックの計算は PC で動きます。
- **ChatGPT：** オーナーが ChatGPT の設定（開発者モード）で、上の表の URL をコネクタとして追加します。パブリックはチャットに添付したファイルを読みます。WORKS はまだ ChatGPT で試していません。
- **そのほかのクライアント：** パブリックは上の設定で動くはずですが、まだ試していません。WORKS は、m3 がどのクライアントからもサインインできるようになるまで待ちます。
