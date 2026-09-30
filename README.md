# matrix-tsunagi — TSUNAGI///Matrix

The calculations behind TSUNAGI's BMW E46 M3 tools, as a library, a command line and MCP servers.
Read an MSS54HP DME image and a drive log, and get the VE map correction the drive supports. Read an
SMG II gearbox image, and decode and compare its calibration. Read a DME backup or a cluster EEPROM backup,
and check what it holds. On your own machine, with no car and no cable.

```bash
npx matrix-tsunagi mapping ve --sample
```

`--sample` runs on the practice files shipped in the package. Replace it with `--bin <file.bin> --log <file.csv>` for your own.

**TSUNAGI///Matrix** is TSUNAGI's family of tools for the E46 M3 (S54 engine, MSS54HP DME, SMG II):
[m3.tsunagi.app](https://m3.tsunagi.app). This package carries the first category, **MAPPING**, whose tools are
[MSS54HP CSL CONVERT /// TUNER](https://mss54hp-csl-convert-tuner.tsunagi.app/) and E46M3SMG2 /// MAPPING.
The second category, **MIGRATION**, reads the backups of MSS54HP CSL CONVERT /// BOOT and E46 M35080 /// MIGRATION, and only reads them.

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

**What are my SMG II shift points? What is this SMG image?**

```bash
npx matrix-tsunagi mapping smg2 image smg.bin
npx matrix-tsunagi mapping smg2 read smg.bin --xdf Siemens_SMG_II_510_512K.xdf --item "A1 Speed"
```

`smg2 image` needs nothing else: it says whether the image is the 24 KiB calibration window or the full 512 KiB flash, and gives the ZB number and whether the CRC checksums hold.
`smg2 read` decodes every item the MS4X definition names, through E46M3SMG2 /// MAPPING's corrections to it. That includes shift speed thresholds per gear and program, gear ratios, and clutch and launch settings.
The definition (`Siemens_SMG_II_510_24K.xdf` or `_512K.xdf`) is the MS4X Dev Team's and is not shipped here, so pass your own.
The WORKS build of E46M3SMG2 /// MAPPING carries it.

**What changed between two SMG II calibrations?**

```bash
npx matrix-tsunagi mapping smg2 compare before.bin after.bin --xdf Siemens_SMG_II_510_512K.xdf
```

**Which bootloader is in my DME backup, and what is left of the CSL conversion?**

```bash
npx matrix-tsunagi migration boot backup dme-backup.bin
```

From BOOT's full 1 MiB backup: standard M3 or CSL bootloader on each processor, whether each bootloader CRC holds, the program number, and the stages left.
`migration boot compare a.bin b.bin` names where two backups differ.

**What mileage does this cluster EEPROM hold? Is the dump even a real read?**

```bash
npx matrix-tsunagi migration m35080 read eeprom.bin
```

From a 1 KB M35080 backup: whether it is a real chip read (a dead or shorted bus reads as one repeated byte), the mileage in the secure counter, the layout and checksums, and whether the VIN copies agree.
`migration m35080 compare a.bin b.bin` shows which area changed between two dumps.

MIGRATION only reads. The functions that would change an image are not in this package, and `npm run verify` checks the bundle for them.
**The VIN and the DME's identity record are never printed**, because what a command prints goes into the conversation with the assistant.

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

There are two servers, one per category.

The MAPPING server exposes the same calculations as tools. For TUNER: `read_bin`, `read_log`, `propose_ve` and `propose_rfkorr`. For SMG2: `smg2_image`, `smg2_read` and `smg2_compare`. And `about_matrix`. It runs locally over stdio.

The MIGRATION server (`npx -y matrix-tsunagi mcp migration`, or `npx -y matrix-tsunagi-migration`) exposes `boot_backup`, `boot_compare`, `m35080_read`, `m35080_compare` and `about_matrix`, all read-only.

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

`mapping.readBin`, `mapping.readLog` and `mapping.proposeRfKorr` take the same inputs. For SMG2 there are `mapping.smg2Image({ image })`, `mapping.smg2Read({ image, xdf, item })` and `mapping.smg2Compare({ image, other, xdf })`, where `xdf` is the definition's text.

## Putting a result on the car

The calculations are free. Writing a result to the car is done in the apps.

| Result | Written to the car by |
|---|---|
| VE map (`ve`) | [MSS54HP CSL CONVERT /// TUNER](https://mss54hp-csl-convert-tuner.tsunagi.app/), free, in the browser, over a K+DCAN cable. `--out` also saves the same file here. |
| rf_korr table (`rfkorr`) | The WORKS build of TUNER, which makes the file and writes it. This package returns the values only. |
| DME backup (`migration boot`) | Backing a DME up over OBD, verifying it and planning its CSL conversion are done in the WORKS build of MSS54HP CSL CONVERT /// BOOT. |
| Cluster EEPROM (`migration m35080`) | Reading, backing up and repairing the M35080, and carrying a car's true mileage and coding to a replacement cluster, are done in the WORKS build of E46 M35080 /// MIGRATION. The counter only goes up; the tool carries the true reading. |
| SMG II calibration (`smg2`) | Reading it from the car, and editing and exporting it, are done in the WORKS build of E46M3SMG2 /// MAPPING, which carries the MS4X definition. This package reads, decodes and compares only. |

The WORKS builds are for people who have bought MILE on [MESH](https://m3.tsunagi.app/en/mesh), and for owners of cars TSUNAGI has worked on, on request.
They are TUNER's experimental features, E46M3SMG2 /// MAPPING, E46M3 /// MONITORING, MSS54HP CSL CONVERT /// BOOT and E46 M35080 /// MIGRATION.
MILE is a one-time payment, with no subscription and no renewal.
A purchaser can allocate MILE to a MILESTONE to say what they would like it spent on. That is a wish on record, not a promise of any release or date.

## Inputs

- **BIN**: the 65,536-byte MSS54HP calibration partial ("0401 partial BIN"), the file TUNER reads and writes.
- **Log**: a CSV with a header row, either Testo's MSS54 export or a CSV TUNER exported. Columns are matched as Testo and TUNER spell them. If a required column is missing, the error names the headers that would be accepted.
- **SMG II image**: the 24,576-byte calibration window or the 524,288-byte full flash of the SMG II 510, as E46M3SMG2 /// MAPPING reads and exports them.
- **DME backup**: the 1,048,576-byte full MSS54HP image (master and slave), as BOOT backs it up.
- **M35080 image**: the 1,024-byte cluster EEPROM, as E46 M35080 /// MIGRATION backs it up.
- **XDF**: the MS4X Dev Team's TunerPro definition, `Siemens_SMG_II_510_24K.xdf` for a window or `_512K.xdf` for a full read. The other variant is refused rather than read at the wrong offset.

## Where the numbers come from

This package does not re-implement anything. It bundles each tool's own code from its public repository, at the commit its submodule is pinned to:
[mushitaro/mss54hp-csl-convert-tuner](https://github.com/mushitaro/mss54hp-csl-convert-tuner) (`vendor/tuner`) and
[mushitaro/e46m3smg2-mapping](https://github.com/mushitaro/e46m3smg2-mapping) (`vendor/smg2`),
[mushitaro/mss54hp-csl-convert-boot](https://github.com/mushitaro/mss54hp-csl-convert-boot) (`vendor/boot`) and
[mushitaro/e46-m35080-migration](https://github.com/mushitaro/e46-m35080-migration) (`vendor/m35080`).
Every result names the tool, version and commit in `source`.

`npm run verify` holds the tuned BIN to a SHA-256 measured from TUNER's own DOWNLOAD TUNED, read out of that same commit.
It holds SMG2's decoding to the app's own `loadDefinition`, item by item.
Each has a control that shows the comparison can fail.
The SMG2 check needs the MS4X definitions and a car's image, which are not public. Without them it reports SKIP, which is not a pass.

```bash
git clone --recursive https://github.com/mushitaro/matrix-tsunagi
cd matrix-tsunagi && npm install && npm run verify
```

## 日本語

TSUNAGI///Matrix（BMW E46 M3 のツール群）の計算を、ライブラリ・コマンド・MCP で使えるようにしたパッケージです。
MSS54HP の BIN と走行ログ（Testo の CSV）から、VE マップの補正案、ログのどこが使われなかったかとその直し方、rf_korr の表（試験中）を出します。
SMG II の画像からは、ZB 番号とチェックサム、較正の解読（変速点など）、2 本の比較を出します。解読には、お手持ちの MS4X の XDF が要ります。
MIGRATION は、DME のバックアップ（ブートローダの種類と CRC、CSL 化の残り）と、メーターの M35080 のバックアップ（走行距離、チェックサム、VIN の一致）を読むだけで、書き換えはしません。VIN と DME の識別情報は出力しません。
お手元の PC で計算し、どこにも送信しません。ファイルがなくても `--sample` で試せます。

VE マップは MSS54HP CSL CONVERT /// TUNER（無料・ブラウザで動作）で車に書き込めます。
rf_korr などの試験中の機能は、TUNER のワークス版でファイルにして書き込みます。
SMG II の車からの読み取り・編集・書き出しは、E46M3SMG2 /// MAPPING のワークス版で行えます。ワークス版には XDF も入っています。
ワークス版は、[MESH](https://m3.tsunagi.app/mesh) で MILE をご購入いただいた方と、お申し出いただいた施工オーナーさんがお使いいただけます。
MILE は一回限りのお支払いで、自動更新はありません。
MILESTONE への割り当ては使い道のご希望の表示で、公開や時期を約束するものではありません。

## License

MIT, © TSUNAGI. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for what is bundled, including the practice BIN.
