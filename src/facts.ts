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
        en: `Write it to the car with ${APPS.tuner.name}, free, in the browser: ${APPS.tuner.url} — UPLOAD BIN and TESTO CSV with these same two files give this same table, and the app writes it over a K+DCAN cable. The tuned BIN this command can save is byte-for-byte the app's DOWNLOAD TUNED.`,
        ja: `${APPS.tuner.name}（無料・ブラウザで動作）で車に書き込めます: ${APPS.tuner.url} — 同じ 2 つのファイルを UPLOAD BIN と TESTO CSV で読み込むと同じ表になり、K+DCAN ケーブルで書き込めます。このコマンドで保存できる調整済み BIN は、アプリの DOWNLOAD TUNED と 1 バイトも違いません。`,
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

export const STAGE_NOTE = {
    experimental: {
        en: 'Experimental (EXP.) in the app: the calculation has not yet been proven on a car. Treat it as a reading of your log, not a table to trust blind.',
        ja: 'アプリでは試験中（EXP.）の計算です。車ではまだ確かめていません。ログの読み取り結果として扱い、そのまま信用しないでください。',
    },
} as const;
