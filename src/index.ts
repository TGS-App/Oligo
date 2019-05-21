#!/usr/bin/env node
import * as webpack from 'webpack';
import * as wdm from 'webpack-dev-middleware';
import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as VueLoaderPlugin from 'vue-loader/lib/plugin';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as OptimizeCSSPlugin from 'optimize-css-assets-webpack-plugin';
import * as UglifyJsPlugin from 'uglifyjs-webpack-plugin';
import * as WorkboxPlugin from 'workbox-webpack-plugin';


const cwd = process.cwd();
const env = process.argv.includes('--dev') ? 'dev' : process.argv.includes('--cordova') ? 'cordova' : 'prod'; // eslint-disable-line

const webTemp = path.join(__dirname, '../tmp');
const $ = (dir: string): string => path.join(cwd, dir);

const browsers = [
  'Android >= 5',
  'IOS >= 9.3',
  'Edge >= 15',
  'Safari >= 9.1',
  'Chrome >= 49',
  'Firefox >= 31',
  'Samsung >= 5',
];

interface OligoConfig {
  inputs: {
    root: string;
    entry: string;
    jade: string;
    sw?: string;
  };
  outputs: {
    web: string;
    cordova?: string;
    webAssets?: string;
    cordovaAssets?: string;
  };
  googleServices?: string; // FIXME: make use of this
  modules: string[];
  csp?: {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    imgSrc?: string[];
    fontSrc?: string[];
    connectSrc?: string[];
    frameSrc?: string[];
    reportUri?: string[];
  };
  assets?: Record<string, {
    sizes: number[] | string[] | {
      ldpi: number;
      mdpi: number;
      hdpi: number;
      xhdpi: number;
      xxhdpi: number;
      xxxhdpi: number;
    };
    src: string;
    output: string;
  }>;
}

class Oligo {
  private version: string;

  private config: OligoConfig;

  public constructor(version: string, config: OligoConfig) {
    this.version = version;
    this.config = config;
  }

  private static cspToString(CSP: OligoConfig['csp']): string {
    return Object.keys(CSP).map((scope): string => `${scope.replace(/[A-Z]/g, (char): string => `-${char.toLowerCase()}`)} ${CSP[scope].join(' ')}`).join('; ');
  }

  public webpackConfig(): webpack.Configuration {
    return {
      mode: env === 'dev' ? 'development' : 'production',
      entry: [
        'babel-polyfill',
        $(this.config.inputs.entry),
      ],
      output: {
        path: webTemp,
        filename: 'js/app.js',
        publicPath: '',
      },
      resolve: {
        extensions: ['.js', '.vue', '.json'],
        alias: {
          vue$: 'vue/dist/vue.esm.js',
          '@': $(this.config.inputs.root),
        },
      },
      devtool: env === 'dev' ? 'eval' : 'source-map',
      module: {
        rules: [
          {
            test: /\.pug$/,
            loader: 'pug-plain-loader',
            include: $(this.config.inputs.root),
          },
          {
            test: /\.js$/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  ['@babel/preset-env', { modules: false, targets: { browsers } }],
                ],
                plugins: ['@babel/plugin-syntax-dynamic-import'],
              },
            },
            include: [
              // even if it's not listed here, u can still import
              //  stuff from front-end but babel won't transform it
              $(this.config.inputs.root),

              $('node_modules/framework7'), // FIXME: this is dumb, we don't need to transform these
              $('node_modules/framework7-vue'),
              $('node_modules/template7'),
              $('node_modules/dom7'),
              $('node_modules/ssr-window'),

              ...this.config.modules.map((name: string): string => $(`node_modules/${name}`)),
            ],
          },
          {
            test: /\.vue$/,
            use: 'vue-loader',
            include: [
              $(this.config.inputs.root),
              $('node_modules/framework7'),
              $('node_modules/framework7-vue'),
            ],
          },
          {
            test: /\.css$/,
            use: [
              (env === 'dev' ? 'style-loader' : {
                loader: MiniCssExtractPlugin.loader,
                options: { publicPath: '../' },
              }),
              'css-loader',
            ],
            include: [
              $(this.config.inputs.root),
              $('node_modules/framework7'),
              $('node_modules/framework7-vue'),
            ],
          },
          {
            test: /\.s(a|c)ss$/,
            use: [
              (env === 'dev' ? 'style-loader' : {
                loader: MiniCssExtractPlugin.loader,
                options: {
                  publicPath: '../',
                },
              }),
              'css-loader',
              'sass-loader',
            ],
            include: [
              $(this.config.inputs.root),
              $('node_modules/framework7'),
              $('node_modules/framework7-vue'),
            ],
          },
          {
            test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
            loader: 'url-loader',
            options: {
              limit: 10000,
              name: 'images/[name].[ext]',
            },
            include: [
              $(this.config.inputs.root),
              $('node_modules/framework7'), // FIXME: why do we need to transform images in f7 repo?
              $('node_modules/framework7-vue'),
            ],
          },
          {
            test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
            loader: 'url-loader',
            options: {
              limit: 10000,
              name: 'fonts/[name].[ext]',
            },
            include: [
              $(this.config.inputs.root),
            ],
          },
        ],
      },
      plugins: [
        new webpack.DefinePlugin({
          'process.env': {
            NODE_ENV: JSON.stringify(env === 'dev' ? 'development' : 'production'),
            VERSION: JSON.stringify(this.version),
            CORDOVA: JSON.stringify(env === 'cordova'),
            DATE: JSON.stringify(+new Date()),
          },
        }),
        new VueLoaderPlugin(),
        ...(env !== 'dev' ? [
          // Production only plugins
          new UglifyJsPlugin({
            uglifyOptions: { warnings: false },
            sourceMap: true,
            parallel: true,
          }),
          new OptimizeCSSPlugin({
            cssProcessorOptions: {
              safe: true,
              map: { inline: false },
            },
          }),
          new webpack.optimize.ModuleConcatenationPlugin(),
        ] : [
          // Development only plugins
          new webpack.HotModuleReplacementPlugin(),
          new webpack.NamedModulesPlugin(),
        ]),
        new HtmlWebpackPlugin({
          filename: 'index.html', // output name
          template: `!!pug-loader!${$(this.config.inputs.jade)}`,
          inject: true,
          csp: this.config.csp && Oligo.cspToString(this.config.csp),
          isCordova: env === 'cordova',
          minify: env !== 'dev' ? {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
          } : false,
        }),
        new MiniCssExtractPlugin({ filename: 'css/app.css' }),
        ...(env !== 'cordova' && this.config.inputs.sw ? [
          new WorkboxPlugin.InjectManifest({
            swSrc: $(this.config.inputs.sw),
          }),
        ] : []),
      ],
    };
  }

  public async build(): Promise<webpack.Watching | webpack.Compiler> {
    if (this.config.outputs.webAssets) await fs.remove($(this.config.outputs.webAssets));
    if (this.config.outputs.cordova) await fs.remove($(this.config.outputs.cordova));
    await fs.remove(webTemp);
    if (this.config.assets) await this.assets();
    console.log('Webpack build in progress... (this can take up to 5 minutes)');

    return webpack(this.webpackConfig(), async (err, stats): Promise<void> => {
      if (err) throw err;

      console.log(stats.toString({
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
      }));

      if (stats.hasErrors()) {
        console.log('❌ Build failed with errors.\n');
        process.exit(1);
      }

      console.log('Copying temp files to output...');
      const output = $(this.config.outputs[env === 'cordova' ? 'cordova' : 'web']);
      await fs.remove(output);
      await fs.copy(webTemp, output);
      await fs.remove(webTemp);

      console.log('✔ Build complete.\n');
      process.exit(0);
    });
  }

  private async assets(): Promise<void> {
    interface ResizeArgs {
      src: string;
      size: number[] | number;
      sizeName?: string;
      output: string;
    }
    const resize = async ({
      src, size, sizeName, output,
    }: ResizeArgs): Promise<sharp.OutputInfo> => sharp($(src))
      .resize(...(Array.isArray(size) ? size : [size]))
      .toFile($(output.replace(/{{size}}/g, sizeName || String(size))));

    let count = 0;
    try {
      for (const name in this.config.assets) {
        const { src, sizes, output } = this.config.assets[name];
        if (Array.isArray(sizes)) { // if an array
          for (const size of sizes) {
            await fs.mkdirs(path.parse(output.replace(/{{size}}/g, String(size))).dir);
            if (typeof size === 'string') {
              await resize({
                src, size: size.split('x').map(Number), sizeName: size, output,
              });
            } else {
              await resize({ src, size, output });
            }
            count += 1;
          }
        } else { // if an object
          for (const sizeName in sizes) {
            await fs.mkdirs(path.parse(output.replace(/{{size}}/g, sizeName)).dir);
            await resize({
              src, size: sizes[sizeName], sizeName, output,
            });
          }
          count += 1;
        }
      }
      console.log('Copying files...');
      await fs.copy($(this.config.outputs.webAssets), $(this.config.outputs.cordovaAssets));
      console.log(`Converted ${count} assets!`);
    } catch (err) {
      console.error(`Conversion failed after ${count} assets!`, err);
      process.exit(1);
    }
  }
}

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

if (require.main !== module) cli();

module.exports = function oligo(): wdm.WebpackDevMiddleware {
  console.log(`🦖 🦕 Oligo live (${env}) from ${cwd}`);
  const compiler = webpack(new Oligo(version, config).webpackConfig());
  return wdm(compiler, {
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
};
