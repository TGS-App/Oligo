import * as webpack from 'webpack';
import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as VueLoaderPlugin from 'vue-loader/lib/plugin';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as OptimizeCSSPlugin from 'optimize-css-assets-webpack-plugin';
import * as TerserPlugin from 'terser-webpack-plugin';
import * as WorkboxPlugin from 'workbox-webpack-plugin';
import * as SpeedMeasurePlugin from 'speed-measure-webpack-plugin';

const smp = new SpeedMeasurePlugin();

export const cwd = process.cwd();
export const env = process.argv.includes('--dev') ? 'dev' : process.argv.includes('--cordova') ? 'cordova' : 'prod'; // eslint-disable-line
export const configFilePath = (/--config (.+\.json)/.exec(process.argv.join(' ')) || [])[1] || 'oligo.json';

const webTemp = path.join(__dirname, '../tmp');
export const $ = (dir: string): string => path.join(cwd, dir);

const browsers = [
  'Android >= 5',
  'IOS >= 9.3',
  'Edge >= 15',
  'Safari >= 9.1',
  'Chrome >= 49',
  'Firefox >= 31',
  'Samsung >= 5',
];

export interface OligoConfig {
  inputs: {
    root: string;
    entry: string;
    sw?: string;
  };
  outputs: {
    web: string;
    cordova?: string;
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
  copy?: Record<string, string>;
}

export class Oligo {
  private version: string;

  private config: OligoConfig;

  public constructor(version: string, config: OligoConfig) {
    this.version = version;
    this.config = config;
  }

  private static cspToString(CSP: OligoConfig['csp']): string {
    return Object.keys(CSP).map((scope): string => `${scope} ${CSP[scope].join(' ')}`).join('; ');
  }

  public webpackConfig(): webpack.Configuration {
    return smp.wrap({
      mode: env === 'dev' ? 'development' : 'production',
      entry: [
        'babel-polyfill',
        $(this.config.inputs.entry),
      ],
      output: {
        path: webTemp,
        filename: 'js/[name].[contenthash].js',
        publicPath: env === 'cordova' ? '/android_asset/www/' : '/',
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
                cacheDirectory: true,
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
              {
                loader: MiniCssExtractPlugin.loader,
                options: { publicPath: '../' },
              },
              'css-loader?-url',
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
              {
                loader: MiniCssExtractPlugin.loader,
                options: { publicPath: '../' },
              },
              'css-loader?-url',
              'sass-loader',
            ],
            include: [
              $(this.config.inputs.root),
              $('node_modules/framework7'),
              $('node_modules/framework7-vue'),
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
        new webpack.HashedModuleIdsPlugin(),
        new VueLoaderPlugin(),
        ...(env !== 'dev' ? [
          // Production only plugins
          new OptimizeCSSPlugin({
            cssProcessorOptions: {
              safe: true,
              map: { inline: false },
            },
          }),
        ] : [
          // Development only plugins
          // new webpack.HotModuleReplacementPlugin(),
          // new webpack.NamedModulesPlugin(),
        ]),
        new HtmlWebpackPlugin({
          filename: 'index.html', // output name
          template: `${$(this.config.inputs.root)}/index.html`,
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
      optimization: {
        minimizer: [new TerserPlugin({
          cache: true,
          parallel: true,
        })],
        runtimeChunk: 'single',
        splitChunks: {
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      },
    });
  }

  public async build(): Promise<webpack.Watching | webpack.Compiler> {
    const output = $(this.config.outputs[env === 'cordova' ? 'cordova' : 'web']);
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

      await fs.remove(output);
      await fs.copy(webTemp, output);
      await fs.remove(webTemp);

      if (this.config.assets) await this.assets();

      if (this.config.copy) {
        for (const file in this.config.copy) {
          await fs.copy($(file), $(this.config.copy[file]));
          console.log(`copied ${file} -> ${this.config.copy[file]}`);
        }
      }

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
      console.log(`Converted ${count} assets!`);
    } catch (err) {
      console.error(`Conversion failed after ${count} assets!`, err);
      process.exit(1);
    }
  }
}
