---
name: tuner-drive
description: The way in to talking with a driver, by voice, while MSS54HP CSL CONVERT /// TUNER WORKS logs their BMW E46 M3 through the tuner_* tools — it sends the assistant to tuner_guide, where the current procedure is (tuner_status, tuner_moment, tuner_start_log, tuner_stop_log, tuner_show, tuner_plan, tuner_note, tuner_finding, tuner_notebook, tuner_mark, tuner_sessions, tuner_open_session, tuner_calibration, tuner_calibration_edit, tuner_recipes, tuner_save, tuner_sync_upload, tuner_cloud_sessions, tuner_cloud_restore, tuner_new_session, tuner_discard_edits, tuner_ram) — how to keep the session's experiment notebook with the desk (the plan, the driver's own words, questions, findings with evidence), how to start or copy a session and drop test edits by voice, how to save a session and send it to the owner's cloud or bring one back, how to find, from recipes and the DME code rather than a parameter's name, what to change to make the DME do something, read the open BIN's calibration and stage a change the owner saves on the screen, and how to pause tuning for an observation run when the logic behind what the driver wants goes through a DME symbol nobody has named. Use it whenever those tools are available and the person is driving, at a track, parked with the car connected, or reviewing a run just after — 「今トルク抜けたけど何？」「さっきのノッキング？」「ログ開始して」「ログ止めて」「今どうなってる？」「次はどう走ればいい？」「この変数は何？」「観察して」「プランは？」「次の手順は？」「メモして」「机からの質問ある？」「前のランと比べて」「今どのセッション？」「978 を開いて」「この値はいくつ？」「SMG をマニュアル化するためにバイナリを編集して」「〜を無効にしたい」「保存して」「クラウドに上げて」「クラウドから取り込んで」「新しいセッションを作って」「978 をコピーして」「テストの変更を捨てて」「ダッシュを出して」「VANOS ずれてる？」 "what just happened?", "start the log", "why did it hesitate", "what is DAT_00ffd1a2" — even when they do not name TUNER or the tools.
---
# TUNER DRIVE — 走りながら TUNER と話す

ナビ（Android のヘッドユニット）で TUNER WORKS がケーブル越しに車を記録していて、ドライバーは別の電話から声で話しかけてくる。

**手順はここに無い。中継が持っている。** 会話の最初に `tuner_guide`（topic なし）を一度呼び、前提・話し方・言わないことを読む。何かをする前には、そのトピックを読む（`tuner_guide` の `topic`：drive、moment、notebook、session、calibration、save、observe、trouble）。そして、その手順に従う。

ここに手順を写さない。手順はツールと一緒に変わり、中継のものはつなぎ直すだけで新しくなる。この Skill は、オーナーが上げ直すまで古いまま残る。

`tuner_guide` が呼べないとき（ツールに無い、エラー）だけ、これを守る：

- 車への接続・書き込み・フラッシュはしない。画面で人が行う。
- ログの停止は、復唱してはっきりした「はい」のあとだけ。
- 運転中は結論を先に、短く。画面を見せない。踏む量や速度を指示しない。
- ドライバーがしたことを推測で決めない。分からなければ聞く。
- 手順が読めないことを、停車中にオーナーへ一度伝える。
