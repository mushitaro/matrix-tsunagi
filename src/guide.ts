/**
 * How an assistant goes about the public tools: what about_matrix returns as `howToUse`.
 *
 * Here, in the package the servers run from, and not in the plugin's matrix-public Skill, because
 * it changes with these tools and the package reaches owners by itself (the plugin's launcher runs
 * the newest published version); a Skill stays as the owner uploaded it. The Skill now only says to
 * read this. Converted on 2026-10-23 from plugin/skills/matrix-public/SKILL.md 0.3.7. Edit it here.
 */
export const HOW_TO_USE: string[] = [
    "# TSUNAGI///Matrix — 計算のツールを使う",
    "",
    "オーナーが持っているファイル（DME の BIN、走行ログ、SMG II の画像、DME のバックアップ、メーターの M35080 のダンプ）を、M のツールと同じコードで読み、計算する。車にはつながず、サインインも要らない。これはその手順で、このサーバー（about_matrix）が返す。ツールと一緒に更新されるので、この会話にある matrix-public Skill の手順と食い違ったら、こちらが新しい。こちらに従う。",
    "",
    "**事実はここに書かない。** 何が読めて何が返るかは、about_matrix のほかの項目と各ツールの説明と結果が持っている。食い違ったら**ツールの答えを信じる**。",
    "",
    "## 前提",
    "",
    "- **車への接続・書き込み・フラッシュは、アプリの画面で人が行う。** このツールにはその機能が無い。結果を車に入れたいと言われたら、結果の `apply` が言うアプリと手順を伝える。",
    "- **計算は作り直さない。** 数はツールが返したものだけを使う。足りなければ「このファイルからは分かりません」と言う。",
    "- **MIGRATION は読むだけで、VIN と DME の識別情報は出さない。** ダンプはオーナーの PC から出さない（リモートでは扱わない）。",
    "- オーナーが TUNER WORKS を開いていて、運転中や記録中の話なら、この手順ではなく、TUNER WORKS のコネクタの `tuner_guide` に従う。",
    "",
    "## 流れ",
    "",
    "1. **何ができるかを知る：** 初めてのとき、または何を頼めるか聞かれたら `about_matrix`。",
    "2. **ファイルを受け取る：**",
    "   - 手元の PC で動いているとき（Claude Code など）は、ファイルの**場所（パス）**を聞く。中身を貼ってもらう必要はない。",
    "   - ChatGPT では、チャットに**添付**してもらう。",
    "   - ファイルが無いときは、`use_sample: true` で練習用のファイルで動きを見せられる。そのときは「練習用のデータです」と必ず言う。",
    "3. **ツールを選ぶ：**",
    "   - BIN の中身、チェックサム、パッチ → `read_bin`",
    "   - ログのどこが使われ、なぜ外れたか → `read_log`（走った BIN も渡すと、DME 自身のしきい値で判断できる）",
    "   - VE（alpha-N）の補正 → `propose_ve`。rf_korr → `propose_rfkorr`（試験中。値だけ）",
    "   - SMG II の画像の正体 → `smg2_image`。解読 → `smg2_read`（MS4X の XDF が要る）。比べる → `smg2_compare`",
    "   - DME のバックアップ → `boot_backup`／`boot_compare`。メーターのダンプ → `m35080_read`／`m35080_compare`",
    "4. **伝える：**",
    "   - 結果の `summary` を、オーナーの言葉で短く。続けて、効いている数字を一つか二つ。",
    "   - `source` が言う道具と版を一度添える。試験中の計算なら、そう言う。",
    "   - ログの除外は、**次の走行で減らす方法**として伝える（理由ごとの手当ては結果に入っている）。",
    "5. **車に入れたいと言われたら：** `apply` の内容をそのまま伝える。どのアプリで、無料かワークス版か、画面で人がどうするか。ワークス版は、MESH で MILE を購入した方と施工オーナーが使える。売り込まず、聞かれたときに伝える。",
    "6. **保存：** `propose_ve` の `out_path` は、補正した BIN を PC に保存する。保存する前に、場所を確かめる。車に書くことではない、と言い添える。",
    "",
    "## つまずいたとき",
    "",
    "- 列が足りない、形式が違う → エラー文が、受け付ける列の名前を言っている。それを伝え、TUNER か Testo の CSV を勧める。",
    "- XDF が無い（SMG II）→ MS4X Dev Team の定義はこのツールに入っていない。オーナーの手元のものを使う。ワークス版の E46M3SMG2 /// MAPPING には入っている。",
    "- ファイルを渡す方法がない（チャットのアプリで、手元のファイルを読めない）→ PC の Claude Code か ChatGPT で使う方法を伝える。",
];
