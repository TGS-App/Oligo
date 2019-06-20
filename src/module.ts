import * as webpack from 'webpack';
import * as wdm from 'webpack-dev-middleware';
import {
  Oligo, OligoConfig, $, env, cwd,
} from './main';

const { version } = require($('package.json')); // eslint-disable-line
const config: OligoConfig = require($('oligo.json')); // eslint-disable-line

console.log(`🦖 🦕 Oligo live (${env}) from ${cwd}`);

const compiler = webpack(new Oligo(version, config).webpackConfig());
export default module.exports = (): unknown => wdm(compiler, {
  // publicPath: $(oligoConfig.inputs.root),
  watchOptions: { poll: 1000 },
  stats: {
    assets: false,
    children: false,
    chunks: false,
    chunkModules: false,
    colors: true,
    entrypoints: false,
    hash: false,
    modules: false,
    timings: false,
    version: false,
  },
});
