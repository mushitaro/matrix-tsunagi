#!/usr/bin/env node
// The MIGRATION MCP server. It lives in matrix-tsunagi (`matrix-tsunagi mcp migration`); this
// package exists because the MCP Registry proves ownership through one package per server name.
import { serveMigration } from 'matrix-tsunagi/mcp';

await serveMigration();
