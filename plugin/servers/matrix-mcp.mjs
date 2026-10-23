#!/usr/bin/env node
// Starts one of TSUNAGI///Matrix's local public MCP servers for the plugin:
//
//   node matrix-mcp.mjs mapping     the MAPPING tools (TUNER's calculations, SMG II decoding)
//   node matrix-mcp.mjs migration   the MIGRATION tools (DME backups, cluster M35080 dumps; read only)
//
// Why a launcher and not `npx` in .mcp.json: a plugin's .mcp.json is one file for every OS, and
// Claude Code on native Windows cannot start `npx` directly (it is npx.cmd, which needs a shell),
// where macOS and Linux need plain `npx`. `node` starts the same way everywhere, and this script
// makes the one platform-specific choice.
//
// Why npx and not a copy of the servers inside the plugin: the plugin is installed from GitHub,
// where the built bundle is not committed — and a copy would stay as old as the plugin.
//
// Which version: the newest one published to npm, asked for at every start (2026-10-23, the
// operator's request that everything an owner runs update by itself). It used to be pinned here,
// so a new release reached nobody until the owner uploaded a new plugin — and the procedure the
// servers hand out (about_matrix's howToUse) would have stayed as old as the pin. What reaches owners
// is still decided by what is published: publishing to npm is the operator's step. Offline, npm's
// cache answers with the newest version it already holds.
//
// stdin and stdout are the MCP channel, so they pass straight through; nothing here writes to stdout.

import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';

const CATEGORIES = ['mapping', 'migration'];
const SEMVER = /^\d+\.\d+\.\d+$/;

const category = process.argv[2];
if (!CATEGORIES.includes(category)) {
  process.stderr.write(`matrix-mcp: expected one of ${CATEGORIES.join(', ')}, got ${category ?? 'nothing'}\n`);
  process.exit(2);
}

const win = process.platform === 'win32';

/** The newest published version, or null when npm cannot be asked in a few seconds (offline). */
function newest() {
  const r = spawnSync('npm', ['view', 'matrix-tsunagi', 'version', '--prefix', os.tmpdir()], {
    encoding: 'utf8', timeout: 6000, shell: win, windowsHide: true,
  });
  const v = r.status === 0 ? String(r.stdout).trim() : '';
  return SEMVER.test(v) ? v : null;
}

// --prefix: npm looks for "the local project" in the working directory, and inside a checkout of
// matrix-tsunagi itself it takes that project for the package and runs a bin that was never linked
// ("'matrix-tsunagi' is not recognized", measured 2026-10-20). A neutral prefix makes npm fetch the
// package, while the server still runs in the owner's working directory, so a relative file path
// means what the owner meant by it (also measured).
const version = newest();
const args = version
  ? ['--prefix', os.tmpdir(), '-y', `matrix-tsunagi@${version}`, 'mcp', category]
  : ['--prefix', os.tmpdir(), '--prefer-offline', '-y', 'matrix-tsunagi@latest', 'mcp', category];
const child = spawn('npx', args, {
  stdio: 'inherit',
  // npx is npx.cmd on Windows; Node refuses to start a .cmd without a shell. The arguments are fixed
  // above or checked against SEMVER, so the shell sees nothing else that came from outside.
  shell: win,
});

child.on('error', (err) => {
  process.stderr.write(`matrix-mcp: could not start npx (${err.message}). Node.js 18 or later with npm is needed.\n`);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
