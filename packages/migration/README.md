# matrix-tsunagi-migration

The **MIGRATION** MCP server of [TSUNAGI///Matrix](https://github.com/mushitaro/matrix-tsunagi), the BMW E46 M3 tools.

```bash
npx -y matrix-tsunagi-migration
```

It is the same server as `npx -y matrix-tsunagi mcp migration`. This package exists so the MCP Registry can list it as `io.github.mushitaro/matrix-tsunagi-migration`.

The server READS and never changes an image:

- `boot_backup` / `boot_compare` — a full 1 MiB MSS54HP DME backup, from MSS54HP CSL CONVERT /// BOOT: which bootloader each processor carries, whether its CRC holds, the program number, and what the CSL conversion has left to do.
- `m35080_read` / `m35080_compare` — a 1 KB E46 cluster M35080 EEPROM backup, from E46 M35080 /// MIGRATION: whether it is a real chip read, the mileage, the checksums, and whether the VIN copies agree.

The VIN and the DME's identity record are never printed. Everything runs on your own machine and nothing is sent.
Backing up, converting and carrying a car's true mileage to a replacement cluster are done in the tools' WORKS builds.
Those builds are for people who have bought MILE on [MESH](https://m3.tsunagi.app/en/mesh), a one-time payment.

MIT, © TSUNAGI.
