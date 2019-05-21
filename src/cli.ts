#!/usr/bin/env node
import * as path from 'path';
import {
  Oligo, OligoConfig, $, env, cwd,
} from './main';

const { version } = require($('package.json')); // eslint-disable-line
const config: OligoConfig = require($('oligo.json')); // eslint-disable-line

async function cli(): Promise<void> {
  if (process.argv.includes('-v')) {
    const { version: v } = await import(path.join(__dirname, '../package.json'));
    console.log(`🦖 🦕 Oligo v${v} installed in ${__dirname}`);
    return;
  }

  console.log(`🦖 🦕 Oligo building for ${env} from ${cwd}`);
  await new Oligo(version, config).build();
}

cli();
