/**
 * What an assistant may repeat to a person, word for word.
 *
 * Everything here is relayed: an LLM reads these strings and says them to an owner. So each one has
 * to be true as written and has to stay true when paraphrased. Two rules come from the terms of
 * service (m3.tsunagi.app/terms-of-service §3) and are easy to break by being helpful:
 *
 *   - MILE is a one-time purchase with no renewal. Say that; never a subscription.
 *   - A MILESTONE records what a purchaser would like MILE spent on. It does NOT promise a release
 *     or a date. Nothing here may say "when enough MILE is raised, X ships" — an assistant will
 *     turn that into a promise.
 *
 * Lead with what is offered; who it is for comes after (the site's own copy rule).
 */

export const MATRIX = 'TSUNAGI///Matrix';
export const SITE = 'https://m3.tsunagi.app';

export const MESH_URL = { en: `${SITE}/en/mesh`, ja: `${SITE}/mesh` } as const;

/**
 * Matrix's icon, as an MCP server names it: the ///M mark m3's own M menu button wears
 * (tsunagi-m3 public/m-icon.webp), on white so it reads on a dark client too — not the TSUNAGI
 * logo, which a client falls back to from the domain when a server names none (operator,
 * 2026-10-22). Served by the remote server from remote/icons/.
 *
 * claude.ai does not read these: it draws a connector's icon from Google's favicon service for the
 * REGISTRABLE domain of the connector's URL — `tsunagi.app` for matrix-mcp.tsunagi.app — so it shows
 * the TSUNAGI logo whatever this host serves (measured 2026-10-23: /s2/favicons?domain=tsunagi.app).
 * Only a domain of Matrix's own changes that; the operator moves there when Matrix gets one, and
 * leaves tsunagi.app's own favicon alone.
 */
export const MATRIX_ICONS = [
    { src: 'https://matrix-mcp.tsunagi.app/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] },
    { src: 'https://matrix-mcp.tsunagi.app/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
];

export interface AppFact {
    name: string;
    /** The free public build, where there is one. */
    url?: string;
    /** The WORKS build, for MILE purchasers. Its address is not useful to anyone without access, so
     *  what an assistant should hand over is MESH, not this. */
    works: boolean;
}

export const APPS = {
    tuner: {
        name: 'MSS54HP CSL CONVERT /// TUNER',
        url: 'https://mss54hp-csl-convert-tuner.tsunagi.app/',
        works: true,
    },
    smg2: { name: 'E46M3SMG2 /// MAPPING', works: true },
    monitoring: { name: 'E46M3 /// MONITORING', works: true },
    boot: { name: 'MSS54HP CSL CONVERT /// BOOT', works: true },
    m35080: { name: 'E46 M35080 /// MIGRATION', works: true },
} satisfies Record<string, AppFact>;

export const ABOUT = {
    en: [
        `${MATRIX} is TSUNAGI's family of tools for the BMW E46 M3 (S54, MSS54HP DME, SMG II). ${SITE}`,
        'The calculations are open source (MIT) and free. This package runs them on your own machine and sends nothing anywhere.',
        `Connecting to the car is done in the apps. ${APPS.tuner.name} has a free public build: ${APPS.tuner.url}`,
        `The WORKS builds — TUNER's experimental features, ${APPS.smg2.name}, ${APPS.monitoring.name}, ${APPS.boot.name} and ${APPS.m35080.name} — are for people who have bought MILE on MESH, and for owners of cars TSUNAGI has worked on, on request.`,
        `MILE is bought on MESH as a one-time payment, with no subscription and no renewal: ${MESH_URL.en}`,
        'A purchaser can allocate MILE to a MILESTONE to say what they would like it spent on. That is a wish on record, not a promise of any release or date.',
    ],
    ja: [
        `${MATRIX} は、TSUNAGI が作る BMW E46 M3（S54、MSS54HP DME、SMG II）のツール群です。${SITE}`,
        '計算はオープンソース（MIT）で無料です。このパッケージはお手元の PC で計算し、どこにも送信しません。',
        `車への接続はアプリで行います。${APPS.tuner.name} は無料の公開版があります: ${APPS.tuner.url}`,
        `ワークス版（TUNER の試験中の機能、${APPS.smg2.name}、${APPS.monitoring.name}、${APPS.boot.name}、${APPS.m35080.name}）は、MESH で MILE をご購入いただいた方と、お申し出いただいた施工オーナーさんがお使いいただけます。`,
        `MILE は MESH で購入します。一回限りのお支払いで、自動更新はありません: ${MESH_URL.ja}`,
        'ご購入の際、MILE を MILESTONE に割り当てて使い道のご希望を示せます。これはご希望の表示で、公開や時期を約束するものではありません。',
    ],
} as const;

/** How a result gets onto the car. Attached only to results that would have to be written. */
export interface Apply {
    app: string;
    availability: 'free' | 'works';
    url: string;
    how: { en: string; ja: string };
}

export const APPLY_VE: Apply = {
    app: APPS.tuner.name,
    availability: 'free',
    url: APPS.tuner.url,
    how: {
        en: `Write it to the car with ${APPS.tuner.name}, free, in the browser: ${APPS.tuner.url} — UPLOAD BIN and TESTO CSV with these same two files give this same table under the app's default settings, and the app writes it over a K+DCAN cable. The tuned BIN this command can save is byte-for-byte the app's DOWNLOAD TUNED.`,
        ja: `${APPS.tuner.name}（無料・ブラウザで動作）で車に書き込めます: ${APPS.tuner.url} — 同じ 2 つのファイルを UPLOAD BIN と TESTO CSV で読み込むと、アプリの初期設定のままなら同じ表になり、K+DCAN ケーブルで書き込めます。このコマンドで保存できる調整済み BIN は、アプリの DOWNLOAD TUNED と 1 バイトも違いません。`,
    },
};

export const APPLY_TUNER_WORKS = (what: { en: string; ja: string }): Apply => ({
    app: `${APPS.tuner.name} — WORKS`,
    availability: 'works',
    url: MESH_URL.en,
    how: {
        en: `${what.en} is made into a file and written to the car by the WORKS build of ${APPS.tuner.name}. The WORKS builds are for people who have bought MILE on MESH (one-time payment): ${MESH_URL.en}`,
        ja: `${what.ja}は、${APPS.tuner.name} のワークス版でファイルにして車に書き込めます。ワークス版は MESH で MILE をご購入いただいた方がお使いいただけます（一回限りのお支払い）: ${MESH_URL.ja}`,
    },
});

/**
 * SMG2 has no public build, and its WORKS build never writes to the gearbox ECU: it reads the
 * calibration from the car, decodes it, and edits and exports the file. So this says reading and
 * exporting, never writing. It also carries the MS4X definition behind the owner gate (SMG2's
 * THIRD-PARTY-NOTICES §2.2), which is the one thing an owner without the XDF cannot get here.
 */
export const APPLY_SMG2: Apply = {
    app: `${APPS.smg2.name} — WORKS`,
    availability: 'works',
    url: MESH_URL.en,
    how: {
        en: `Reading the calibration from your own car, and editing and exporting it, are done in the WORKS build of ${APPS.smg2.name}. It carries the MS4X definition, so no XDF of your own is needed there. The WORKS builds are for people who have bought MILE on MESH (one-time payment): ${MESH_URL.en}`,
        ja: `ご自身の車からの較正の読み取り、編集、書き出しは、${APPS.smg2.name} のワークス版で行えます。ワークス版には MS4X の定義が入っているので、XDF をお持ちでなくても解読できます。ワークス版は MESH で MILE をご購入いただいた方がお使いいただけます（一回限りのお支払い）: ${MESH_URL.ja}`,
    },
};

/**
 * BOOT's WORKS build backs a DME up over OBD and plans its CSL conversion. Its hardware write lock
 * is off (writeLock.ts, HARDWARE_WRITE_ENABLED = false), so it is never said to write.
 */
export const APPLY_BOOT: Apply = {
    app: `${APPS.boot.name} — WORKS`,
    availability: 'works',
    url: MESH_URL.en,
    how: {
        en: `Backing a DME up over OBD, verifying the backup, and planning its CSL conversion are done in the WORKS build of ${APPS.boot.name}. The WORKS builds are for people who have bought MILE on MESH (one-time payment): ${MESH_URL.en}`,
        ja: `OBD からの DME のバックアップ、その検証、CSL 化の計画は、${APPS.boot.name} のワークス版で行えます。ワークス版は MESH で MILE をご購入いただいた方がお使いいただけます（一回限りのお支払い）: ${MESH_URL.ja}`,
    },
};

/**
 * M35080's WORKS build does write the cluster EEPROM, and what it is for is carrying a car's TRUE
 * mileage and coding to a replacement cluster (its README, "The constraint that shapes
 * everything"). The secure counter can only be raised, and the sentence says so, so nobody reads
 * this as a way to lower a reading.
 */
export const APPLY_M35080: Apply = {
    app: `${APPS.m35080.name} — WORKS`,
    availability: 'works',
    url: MESH_URL.en,
    how: {
        en: `Reading the M35080 EEPROM from the cluster, backing it up and repairing it, and carrying the car's true mileage and coding over to a replacement cluster, are done in the WORKS build of ${APPS.m35080.name}. The mileage counter can only be raised, and the tool exists to carry the true reading, never to lower one. The WORKS builds are for people who have bought MILE on MESH (one-time payment): ${MESH_URL.en}`,
        ja: `メーターからの M35080 EEPROM の読み取り、バックアップと修復、交換するメーターへの本来の走行距離とコーディングの引き継ぎは、${APPS.m35080.name} のワークス版で行えます。走行距離のカウンタは増やす方向にしか書けず、本来の値を引き継ぐためのもので、減らすためのものではありません。ワークス版は MESH で MILE をご購入いただいた方がお使いいただけます（一回限りのお支払い）: ${MESH_URL.ja}`,
    },
};

export const STAGE_NOTE = {
    experimental: {
        en: 'Experimental (EXP.) in the app: the calculation has not yet been proven on a car. Treat it as a reading of your log, not a table to trust blind.',
        ja: 'アプリでは試験中（EXP.）の計算です。車ではまだ確かめていません。ログの読み取り結果として扱い、そのまま信用しないでください。',
    },
} as const;
