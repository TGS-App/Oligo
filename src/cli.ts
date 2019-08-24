#!/usr/bin/env node
import * as path from 'path';
import {
  Oligo, OligoConfig, $, env, cwd, configFilePath,
} from './main';

const { version } = require($('package.json')); // eslint-disable-line
const config: OligoConfig = require($(configFilePath)); // eslint-disable-line

async function cli(): Promise<void> {
  const { version: v } = await import(path.join(__dirname, '../package.json'));
  if (process.argv.includes('-v')) {
    console.log(`🦖 🦕 Oligo v${v} installed in ${__dirname}`);
    return;
  }

  console.log(`🦖 🦕 Oligo v${v} building for ${env} from ${cwd}`);
  await new Oligo(version, config).build();
}

cli();
