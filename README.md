# matrix-tsunagi — TSUNAGI///Matrix

The calculations behind TSUNAGI's BMW E46 M3 tools, as a library, a command line and MCP servers.
Read an MSS54HP DME image and a drive log, and get the VE map correction the drive supports —
on your own machine, with no car and no cable.

```bash
npx matrix-tsunagi mapping ve --sample
```

`--sample` runs on the practice files shipped in the package. Replace it with `--bin <file.bin> --log <file.csv>` for your own.

**TSUNAGI///Matrix** is TSUNAGI's family of tools for the E46 M3 (S54 engine, MSS54HP DME, SMG II):
[m3.tsunagi.app](https://m3.tsunagi.app). This package carries the first category, **MAPPING**, whose tool is
[MSS54HP CSL CONVERT /// TUNER](https://mss54hp-csl-convert-tuner.tsunagi.app/).

## Ask it

**How do I correct the VE (alpha-N) map of my CSL-converted MSS54HP from a Testo log?**

```bash
npx matrix-tsunagi mapping ve --bin my.bin --log drive.csv --out tuned.bin
```

Which cells change and by how much, which need more driving and how to drive them, and — with `--out` — the
tuned BIN with its checksums corrected. That file is byte-for-byte what TUNER's DOWNLOAD TUNED gives for the same two files.

**What is in my MSS54HP bin? Are its checksums right? Which patches are on it?**

```bash
npx matrix-tsunagi mapping bin my.bin
```

**Why did most of my log get thrown away?**

```bash
npx matrix-tsunagi mapping log drive.csv --bin my.bin
```

Every reason a sample was left out (cold engine, transient, full load, overrun…), each with what to change on the next drive.

**What rf_korr table does my drive support?** *(experimental)*

```bash
npx matrix-tsunagi mapping rfkorr --bin my.bin --log drive.csv
```

The exhaust-temperature density correction (KF_RF_KORR_DRREL), cell by cell, with the evidence behind each.

**What can it do?**

```bash
npx matrix-tsunagi describe
```

## For AI assistants

- Run `npx matrix-tsunagi describe` once. Every command prints JSON on stdout, and errors come as JSON on stderr with exit code 1.
- Each result has a `summary` to relay, `result` with the numbers, and `source`, which says which tool and version computed it and whether the calculation is experimental.
- `apply` appears only when the owner would have to write the result to the car. It names the app, says whether the app is free or WORKS, and says how. `apply.how` and `source.note` are in English and Japanese.
- With no files yet, add `--sample` to show the command working on the practice BIN and drive.
- Nothing is sent anywhere. Files are read from the paths you give.

## MCP

The MAPPING server exposes the same calculations as tools: `read_bin`, `read_log`, `propose_ve`, `propose_rfkorr` and `about_matrix`. It runs locally over stdio.

Claude Code:

```bash
claude mcp add matrix-tsunagi-mapping -- npx -y matrix-tsunagi mcp mapping
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "matrix-tsunagi-mapping": {
      "command": "npx",
      "args": ["-y", "matrix-tsunagi", "mcp", "mapping"]
    }
  }
}
```

On Windows, if `npx` is not found, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "matrix-tsunagi", "mcp", "mapping"]`.

## Library

```js
import { mapping } from 'matrix-tsunagi';
import fs from 'node:fs';

const ve = mapping.proposeVe({
  bin: new Uint8Array(fs.readFileSync('my.bin')),
  csv: fs.readFileSync('drive.csv', 'utf8'),
});
console.log(ve.summary);
fs.writeFileSync('tuned.bin', ve.tunedBin);
```

`mapping.readBin`, `mapping.readLog` and `mapping.proposeRfKorr` take the same inputs.

## Putting a result on the car

The calculations are free. Writing a result to the car is done in the apps.

| Result | Written to the car by |
|---|---|
| VE map (`ve`) | [MSS54HP CSL CONVERT /// TUNER](https://mss54hp-csl-convert-tuner.tsunagi.app/), free, in the browser, over a K+DCAN cable. `--out` also saves the same file here. |
| rf_korr table (`rfkorr`) | The WORKS build of TUNER, which makes the file and writes it. This package returns the values only. |

The WORKS builds are for people who have bought MILE on [MESH](https://m3.tsunagi.app/en/mesh), and for owners of cars TSUNAGI has worked on, on request.
They are TUNER's experimental features, E46M3SMG2 /// MAPPING, E46M3 /// MONITORING, MSS54HP CSL CONVERT /// BOOT and E46 M35080 /// MIGRATION.
MILE is a one-time payment, with no subscription and no renewal.
A purchaser can allocate MILE to a MILESTONE to say what they would like it spent on. That is a wish on record, not a promise of any release or date.

## Inputs

- **BIN**: the 65,536-byte MSS54HP calibration partial ("0401 partial BIN"), the file TUNER reads and writes.
- **Log**: a CSV with a header row, either Testo's MSS54 export or a CSV TUNER exported. Columns are matched as Testo and TUNER spell them. If a required column is missing, the error names the headers that would be accepted.

## Where the numbers come from

This package does not re-implement anything. It bundles TUNER's own code from the public repository
[mushitaro/mss54hp-csl-convert-tuner](https://github.com/mushitaro/mss54hp-csl-convert-tuner), at the commit the `vendor/tuner` submodule is pinned to.
Every result names that version and commit in `source`.

`npm run verify` holds the tuned BIN to a SHA-256 measured from the app's own DOWNLOAD TUNED, read out of that same commit.
It also runs a control showing the comparison can fail.

```bash
git clone --recursive https://github.com/mushitaro/matrix-tsunagi
cd matrix-tsunagi && npm install && npm run verify
```

## 日本語

TSUNAGI///Matrix（BMW E46 M3 のツール群）の計算を、ライブラリ・コマンド・MCP で使えるようにしたパッケージです。
MSS54HP の BIN と走行ログ（Testo の CSV）から、VE マップの補正案、ログのどこが使われなかったかとその直し方、rf_korr の表（試験中）を出します。
お手元の PC で計算し、どこにも送信しません。ファイルがなくても `--sample` で試せます。

VE マップは MSS54HP CSL CONVERT /// TUNER（無料・ブラウザで動作）で車に書き込めます。
rf_korr などの試験中の機能は、TUNER のワークス版でファイルにして書き込みます。
ワークス版は、[MESH](https://m3.tsunagi.app/mesh) で MILE をご購入いただいた方と、お申し出いただいた施工オーナーさんがお使いいただけます。
MILE は一回限りのお支払いで、自動更新はありません。
MILESTONE への割り当ては使い道のご希望の表示で、公開や時期を約束するものではありません。

## License

MIT, © TSUNAGI. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for what is bundled, including the practice BIN.
