# Third-party notices and data provenance

This package's own code is MIT (`LICENSE`). Nothing below is relicensed by that. This is a record of
facts, not legal advice.

## 1. The calculation: MSS54HP CSL CONVERT /// TUNER

Everything this package computes is TUNER's own code, bundled from the public repository
[mushitaro/mss54hp-csl-convert-tuner](https://github.com/mushitaro/mss54hp-csl-convert-tuner) (MIT, TSUNAGI) at
the commit the `vendor/tuner` submodule is pinned to. `dist/provenance.json` and every result's `source` name that commit.

TUNER in turn rests on work the E46 M3 community published first. Its README §Credits names each one
and what rests on it; the parts that reach this package are:

- **[Pavlo](https://nam3forum.com/forums/member/1552-pavlo)**, who published the street-tuning method for the CSL conversion that TUNER automates:
  [the thread](https://nam3forum.com/forums/forum/special-interests/coding-tuning/242281-a-quick-and-easy-way-to-street-tune-your-csl-conversion-for-drivability).
- **[karter16](https://nam3forum.com/forums/member/9797-karter16)**, whose TunerPro definition `CSL_0401_Karter16_v3_6_publish.xdf` is where every calibration address and scaling in TUNER's `src/config/constants.ts` and `src/lib/ecu-items/` comes from.
  The XDF itself is not in this package, and neither is any third-party XDF.

## 1b. E46M3SMG2 /// MAPPING

SMG2's reading of an SMG II 510 image is its own code, bundled from the public repository
[mushitaro/e46m3smg2-mapping](https://github.com/mushitaro/e46m3smg2-mapping) (MIT, TSUNAGI) at the commit `vendor/smg2` is pinned to.
That code is the XDF engine, SMG2's catalog of corrections to the definition, the checksum and the ZB anchor.
Its `packages/ds2-core` is a copy of the same package in [E46M3-Monitoring](https://github.com/mushitaro/E46M3-Monitoring) (MIT, the same author).

- **The MS4X Dev Team** wrote the TunerPro definitions `Siemens_SMG_II_510_24K.xdf` and `_512K.xdf`, which were supplied by Olza. **They are not in this package.**
  The owner passes their own. SMG2's catalog corrects the definition by `uniqueId`, and each entry states the vendor's value it expects.
  The corrections are SMG2's measurement; the definition they correct is MS4X's.
- SMG2's **practice image** is built at run time by SMG2's own `buildPracticeImage()`. Its bytes are invented, and every result that uses it says PRACTICE.

## 1c. MSS54HP CSL CONVERT /// BOOT and E46 M35080 /// MIGRATION (read only)

Both are bundled from their public repositories (MIT, TSUNAGI) at the commits `vendor/boot` and `vendor/m35080` are pinned to:
[mushitaro/mss54hp-csl-convert-boot](https://github.com/mushitaro/mss54hp-csl-convert-boot) and [mushitaro/e46-m35080-migration](https://github.com/mushitaro/e46-m35080-migration).
Only their reading functions are bundled.

- BOOT's offsets, CRCs and the byte values that tell one bootloader from another are facts about the DME and its firmware, as that repository's THIRD-PARTY-NOTICES §3 records. No BMW file is included.
- M35080's odometer and VIN encoding derive from [gerchanovsky/m35080_odometer_fix](https://github.com/gerchanovsky/m35080_odometer_fix) (the Unlicense), forked from `kaeferfreund/m35080_Read_BitBang`. This package uses only the decoding side.
- **`samples/practice-m35080.bin`** is written at build time by M35080's own test fixture (`web/test/support/lateImage.ts`). Its mileage and VIN are made up. BOOT's practice image is built at run time by BOOT's own `practiceEcuImage()`.

## 2. The practice files (`samples/`)

Both are already public in the TUNER repository. `npm run verify` checks that they match it byte for byte.

- **`samples/practice.bin`** is TUNER's `public/mock/csl-0401-community-patch-v1.partial.bin`: the CSL 0401 Community Patch v1 partial,
  published openly by the E46 M3 community. TUNER's PRACTICE mode serves it as a simulated DME. It is a 64 KB calibration partial,
  not a BMW program image.
- **`samples/practice-drive.testo.csv`** is TUNER's `scripts/fixtures/practice-drive.testo.csv`: a PRACTICE drive over that partial,
  computed from the partial's own tables and written by TUNER's exporter. No car was driven, and it holds no vehicle's data.

## 3. Not in this package

BMW program images, bootloaders, full DME or EEPROM dumps, BMW SP-DATEN, third-party XDFs (including the MS4X SMG II definitions),
TUNER's decompiled calibration corpus, and any real vehicle's data.

## 4. Bundled npm packages

The MCP SDK and its dependencies, zod and papaparse, all permissively licensed (MIT, ISC, BSD-3-Clause).
[`THIRD-PARTY-LICENSES.txt`](THIRD-PARTY-LICENSES.txt) reproduces every one in full. The build generates that file from
esbuild's record of what it actually bundled.
