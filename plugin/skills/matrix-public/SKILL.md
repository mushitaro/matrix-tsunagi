---
name: matrix-public
description: How to use TSUNAGI///Matrix's public tools for BMW E46 M3 owners — the calculations of the M tools on the owner's own files, with no car and no sign-in. MAPPING reads an MSS54HP DME image (BIN) and drive logs (read_bin, read_log, propose_ve, propose_rfkorr) and decodes or compares SMG II calibrations (smg2_image, smg2_read, smg2_compare). MIGRATION reads DME backups (boot_backup, boot_compare) and cluster M35080 EEPROM dumps (m35080_read, m35080_compare). Use it whenever those tools are available and the owner asks about a BIN, a Testo or TUNER log, the VE (alpha-N) map, rf_korr, checksums and patches, SMG II shift points, a DME backup or a cluster dump — 「この BIN は？」「VE を補正して」「ログのどこが使われなかった？」「SMG のシフトポイントは？」「バックアップを見て」「メーターの走行距離は？」 "check my bin", "correct my VE map", "why was my log thrown away", "what is in this backup" — even when they do not name Matrix or the tools.
---
# TSUNAGI///Matrix — 計算のツールを使う

オーナーが持っているファイル（DME の BIN、走行ログ、SMG II の画像、DME のバックアップ、メーターの M35080 のダンプ）を、M のツールと同じコードで読み、計算する。車にはつながず、サインインも要らない。

**手順はここに無い。サーバーが持っている。** 最初に `about_matrix` を呼び、その `howToUse` を読んで従う。

ここに手順を写さない。サーバーはプラグインが起動するたびに最新の版になり、手順も一緒に新しくなる。この Skill は、オーナーが上げ直すまで古いまま残る。

`about_matrix` が呼べないときだけ、これを守る：

- 車への接続・書き込み・フラッシュはしない。結果を車に入れるのは、アプリの画面で人が行う。
- 数はツールが返したものだけを使う。計算を作り直さない。
- MIGRATION は読むだけ。VIN と DME の識別情報は出さない。
- オーナーが TUNER WORKS で運転中・記録中の話なら、TUNER WORKS のコネクタの `tuner_guide` に従う。
