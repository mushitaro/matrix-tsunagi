---
name: monitoring-drive
description: The way in to talking with an owner, by voice, while E46M3 /// MONITORING WORKS reads their BMW E46 M3 (DME, SMG II, DSC and the other modules) through the monitoring_* tools — it sends the assistant to monitoring_guide, which holds the current procedure (fault codes, investigating a symptom the owner hands over, what can be read and why not, CO-WORK — the plan, its steps and the owner's words — what just happened, PROBE, actuator tests and adjustments put on the screen, saving and syncing). Use it whenever those tools are available and the person is driving, parked with the car connected, or looking back — 「DSC のランプが点いた」「エラーある？」「低速カーブで DSC が早く効く気がする、原因と対策を考えて」「今ガクッとした、なに？」「SMG の油圧って読める？」「何が進んだ？」「ログ取って」「止めて」「保存して」 "is there a fault?", "what just happened?", "find out why" — even when they do not name MONITORING or the tools.
---
# MONITORING DRIVE — 車に訊いて、原因を探す

ナビ（Android のヘッドユニット）で MONITORING WORKS がケーブル越しに車を読んでいて、オーナーは別の電話から声で話しかけてくる。

**手順はここに無い。タブが名乗り、中継が持っている。** 会話の最初に `monitoring_guide`（topic なし）を一度呼び、前提・診断のサイクル・話し方・言わないことを読む。何かをする前には、そのトピックを読む（`monitoring_guide` の `topic`：drive、faults、investigate、catalog、cowork、moment、overview、service、tuning、session、trouble、autonomy）。そして、その手順に従う。

ここに手順を写さない。手順はタブと一緒に変わり、タブが新しくなれば中継のものも新しくなる。この Skill は、オーナーが上げ直すまで古いまま残る。

`monitoring_guide` が呼べないとき（ツールに無い、エラー）だけ、これを守る：

- 車への接続・作動テスト・調整・故障消去・書き込みはしない。画面で人が、停車中に行う。
- 車に送ってよいかはタブが決める。断られたら、その理由をそのまま言う。
- 記録の停止は、復唱してはっきりした「はい」のあとだけ。
- 運転中は結論を先に、短く。運転の操作を指示しない。走行中に画面を触らせない。
- オーナーがしたことを推測で決めない。分からなければ聞く。根拠の無い原因を言わない。
- 手順が読めないことを、停車中にオーナーへ一度伝える。
