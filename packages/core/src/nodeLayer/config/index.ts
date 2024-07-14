import crypto from 'node:crypto';
import module from 'node:module';
// import { Logger } from "../utils/logger.js";
// import path from "node:path";
import path, { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fse from 'fs-extra';
import { bindingPath } from '../../../binding/index.js';
import { __FARM_GLOBAL__ } from '../../config/_global.js';
import {
  CUSTOM_KEYS,
  DEFAULT_CONFIG_NAMES,
  FARM_DEFAULT_NAMESPACE
} from '../../config/constants.js';
import {
  DEFAULT_COMPILATION_OPTIONS,
  DEFAULT_DEV_SERVER_OPTIONS
} from '../../config/index.js';
import { normalizeExternal } from '../../config/normalize-config/normalize-external.js';
import {
  getValidPublicPath,
  normalizeOutput
} from '../../config/normalize-config/normalize-output.js';
import { normalizePersistentCache } from '../../config/normalize-config/normalize-persistent-cache.js';
import { parseUserConfig } from '../../config/schema.js';
import {
  FarmCLIOptions,
  ResolvedCompilation,
  ResolvedUserConfig,
  UserConfig
} from '../../config/types.js';
import { convertErrorMessage } from '../../utils/error.js';
import { Logger } from '../../utils/logger.js';
import merge from '../../utils/merge.js';
import { traceDependencies } from '../../utils/trace-dependencies.js';
import { OutputConfig, PluginTransformHookParam } from '../types/binding.js';
import { bold, colors, green } from '../utils/color.js';
import {
  isArray,
  isEmptyObject,
  isObject,
  isWindows,
  normalizePath
} from '../utils/share.js';
import {
  CompilationMode,
  getExistsEnvFiles,
  loadEnv,
  setProcessEnv
} from './env.js';

type Format = Exclude<OutputConfig['format'], undefined>;
const formatFromExt: Record<string, Format> = {
  cjs: 'cjs',
  mjs: 'esm',
  cts: 'cjs',
  mts: 'esm'
};

const formatToExt: Record<Format, string> = {
  cjs: 'cjs',
  esm: 'mjs'
};
/**
 * Resolve and load user config from the specified path
 * @param configPath
 */
export async function resolveConfig(
  inlineOptions: any = {},
  command: 'start' | 'build',
  initialMode = 'development',
  initialNodeEnv = 'development'
): Promise<any> {
  let mode = inlineOptions.mode || initialMode;
  setProcessEnv(initialNodeEnv);
  let configEnv = {
    mode,
    command
  };
  const { configFile } = inlineOptions;
  const loadedUserConfig: any = await loadConfigFile(
    configFile,
    inlineOptions,
    configEnv
  );
  console.log(loadedUserConfig);

  mode = inlineOptions.mode || loadedUserConfig.config.mode || mode;
  configEnv.mode = mode;

  // if (loadedUserConfig) {
  //   configPath = loadedUserConfig.configFilePath;
  //   rawConfig = mergeConfig(rawConfig, loadedUserConfig.config);
  // }
  // rawConfig.compilation.mode =
  //   loadedUserConfig?.config?.compilation?.mode ?? mode;
  // mergeConfig(
  //   rawConfig,
  //   await getDefaultConfig(rawConfig, inlineOptions, mode, logger),
  // );

  // const { config: userConfig, configFilePath } = {
  //   configFilePath: configPath,
  //   config: rawConfig
  // };

  // const { jsPlugins, vitePlugins, rustPlugins, vitePluginAdapters } =
  //   await resolvePlugins(userConfig, logger, mode);

  // const sortFarmJsPlugins = getSortedPlugins([
  //   ...jsPlugins,
  //   ...vitePluginAdapters,
  //   externalAdapter()
  // ]);

  // const config = await resolveConfigHook(userConfig, sortFarmJsPlugins);

  // const mergedUserConfig = mergeFarmCliConfig(inlineOptions, config);

  // const resolvedUserConfig = await resolveMergedUserConfig(
  //   mergedUserConfig,
  //   configFilePath,
  //   inlineOptions.mode ?? mode,
  //   logger
  // );

  // // normalize server config first cause it may be used in normalizeUserCompilationConfig
  // resolvedUserConfig.server = normalizeDevServerConfig(
  //   resolvedUserConfig.server,
  //   mode
  // );

  // if (isHandleServerPortConflict) {
  //   await handleServerPortConflict(resolvedUserConfig, logger, mode);
  // }

  // resolvedUserConfig.compilation = await normalizeUserCompilationConfig(
  //   resolvedUserConfig,
  //   mergedUserConfig,
  //   logger,
  //   mode
  // );

  // resolvedUserConfig.root = resolvedUserConfig.compilation.root;
  // resolvedUserConfig.jsPlugins = sortFarmJsPlugins;
  // resolvedUserConfig.rustPlugins = rustPlugins;

  // // Temporarily dealing with alias objects and arrays in js will be unified in rust in the future.]
  // if (vitePlugins.length) {
  //   resolvedUserConfig.compilation.resolve.alias = getAliasEntries(
  //     resolvedUserConfig.compilation.resolve.alias
  //   );
  // }

  // await resolveConfigResolvedHook(resolvedUserConfig, sortFarmJsPlugins); // Fix: Await the Promise<void> and pass the resolved value to the function.

  // // TODO Temporarily solve the problem of alias adaptation to vite
  // if (resolvedUserConfig.compilation?.resolve?.alias && vitePlugins.length) {
  //   resolvedUserConfig.compilation.resolve.alias = transformAliasWithVite(
  //     resolvedUserConfig.compilation.resolve.alias as unknown as Array<Alias>
  //   );
  // }

  // return resolvedUserConfig;
  return {};
}
/**
 * Load config file from the specified path and return the config and config file path
 * @param configPath the config path, could be a directory or a file
 * @param logger custom logger
 * @returns loaded config and config file path
 */
export async function loadConfigFile(
  configFile: string,
  inlineOptions: any,
  configEnv: any,
  logger: Logger = new Logger()
): Promise<{ config: any; configFilePath: string } | undefined> {
  const { root = '.' } = inlineOptions;
  const configRootPath = path.resolve(root);
  let resolvedPath: string | undefined;
  try {
    if (configFile) {
      resolvedPath = path.resolve(root, configFile);
    } else {
      resolvedPath = await getConfigFilePath(configRootPath);
    }
    const config = await readConfigFile(
      inlineOptions,
      resolvedPath,
      configEnv,
      logger
    );
    return {
      config: config && parseUserConfig(config),
      configFilePath: resolvedPath
    };
  } catch (error) {
    // In this place, the original use of throw caused emit to the outermost catch
    // callback, causing the code not to execute. If the internal catch compiler's own
    // throw error can solve this problem, it will not continue to affect the execution of
    // external code. We just need to return the default config.
    const errorMessage = convertErrorMessage(error);
    const stackTrace =
      error.code === 'GenericFailure' ? '' : `\n${error.stack}`;
    if (inlineOptions.mode === 'production') {
      logger.error(
        `Failed to load config file: ${errorMessage} \n${stackTrace}`,
        {
          exit: true
        }
      );
    }
    const potentialSolution =
      'Potential solutions: \n1. Try set `FARM_CONFIG_FORMAT=cjs`(default to esm)\n2. Try set `FARM_CONFIG_FULL_BUNDLE=1`';
    throw new Error(
      `Failed to load farm config file: ${errorMessage}. \n ${potentialSolution} \n ${error.stack}`
    );
  }
}

async function readConfigFile(
  inlineOptions: FarmCLIOptions,
  configFilePath: string,
  configEnv: any,
  logger: Logger
): Promise<UserConfig | undefined> {
  if (fse.existsSync(configFilePath)) {
    !__FARM_GLOBAL__.__FARM_RESTART_DEV_SERVER__ &&
      logger.info(`Using config file at ${bold(green(configFilePath))}`);
    const format: Format = process.env.FARM_CONFIG_FORMAT
      ? process.env.FARM_CONFIG_FORMAT === 'cjs'
        ? 'cjs'
        : 'esm'
      : formatFromExt[path.extname(configFilePath).slice(1)] ?? 'esm';

    // we need transform all type farm.config with __dirname and __filename
    const Compiler = (await import('../../compiler/index.js')).Compiler;

    const outputPath = path.join(
      path.dirname(configFilePath),
      'node_modules',
      '.farm'
    );

    const fileName = `farm.config.bundle-${Date.now()}-${Math.random()
      .toString(16)
      .split('.')
      .join('')}.${formatToExt[format]}`;

    const normalizedConfig = await resolveDefaultUserConfig({
      inlineOptions,
      configFilePath,
      format,
      outputPath,
      fileName
    });

    const compiler = new Compiler(
      {
        config: normalizedConfig,
        jsPlugins: [replaceDirnamePlugin()],
        rustPlugins: []
      },
      logger
    );

    const FARM_PROFILE = process.env.FARM_PROFILE;
    // disable FARM_PROFILE in farm_config
    if (FARM_PROFILE) {
      process.env.FARM_PROFILE = '';
    }
    await compiler.compile();

    if (FARM_PROFILE) {
      process.env.FARM_PROFILE = FARM_PROFILE;
    }

    compiler.writeResourcesToDisk();

    const filePath = isWindows
      ? pathToFileURL(path.join(outputPath, fileName))
      : path.join(outputPath, fileName);

    // Change to vm.module of node or loaders as far as it is stable
    const userConfig = (await import(filePath as string)).default;
    try {
      fse.unlink(filePath, () => void 0);
    } catch {
      /** do nothing */
    }

    const config = await (typeof userConfig === 'function'
      ? userConfig(configEnv)
      : userConfig);

    if (!config.root) {
      config.root = inlineOptions.root;
    }

    if (!isObject(config)) {
      throw new Error(`config must export or return an object.`);
    }
    return config;
  }
}

export async function getConfigFilePath(
  configRootPath: string
): Promise<string | undefined> {
  if (fse.statSync(configRootPath).isDirectory()) {
    for (const name of DEFAULT_CONFIG_NAMES) {
      const resolvedPath = path.join(configRootPath, name);
      const isFile =
        fse.existsSync(resolvedPath) && fse.statSync(resolvedPath).isFile();

      if (isFile) {
        return resolvedPath;
      }
    }
  }
  return undefined;
}

export function replaceDirnamePlugin() {
  const moduleTypes = ['ts', 'js', 'cjs', 'mjs', 'mts', 'cts'];
  const resolvedPaths: string[] = [];
  return {
    name: 'replace-dirname',
    transform: {
      filters: {
        moduleTypes,
        resolvedPaths
      },
      async executor(param: PluginTransformHookParam) {
        const { content, resolvedPath, moduleType } = param;
        let replaceContent = content;
        const dirPath = path.dirname(resolvedPath);

        replaceContent = param.content
          .replace(/__dirname/g, JSON.stringify(dirPath))
          .replace(/__filename/g, JSON.stringify(resolvedPath))
          .replace(
            /import\.meta\.url/g,
            JSON.stringify(pathToFileURL(resolvedPath))
          );

        return {
          content: replaceContent,
          moduleType
        };
      }
    }
  };
}

export async function resolveDefaultUserConfig(options: any) {
  const { inlineOptions, format, outputPath, fileName, configFilePath } =
    options;
  const baseConfig: UserConfig = {
    root: inlineOptions.root,
    compilation: {
      input: {
        [fileName]: configFilePath
      },
      output: {
        entryFilename: '[entryName]',
        path: outputPath,
        format,
        targetEnv: 'node'
      },
      external: [
        ...(process.env.FARM_CONFIG_FULL_BUNDLE
          ? []
          : ['!^(\\./|\\.\\./|[A-Za-z]:\\\\|/).*'])
      ],
      partialBundling: {
        enforceResources: [
          {
            name: fileName,
            test: ['.+']
          }
        ]
      },
      watch: false,
      sourcemap: false,
      treeShaking: false,
      minify: false,
      presetEnv: false,
      lazyCompilation: false,
      persistentCache: false,
      progress: false
    }
  };

  const resolvedUserConfig: ResolvedUserConfig = await resolveUserConfig(
    baseConfig,
    undefined,
    'development'
  );

  const normalizedConfig = await normalizeUserCompilationConfig(
    resolvedUserConfig,
    'development'
  );

  return normalizedConfig;
}

export async function resolveUserConfig(
  userConfig: UserConfig,
  configFilePath: string | undefined,
  mode: 'development' | 'production' | string,
  logger: Logger = new Logger()
): Promise<ResolvedUserConfig> {
  const resolvedUserConfig = {
    ...userConfig,
    compilation: {
      ...userConfig.compilation,
      external: []
    }
  } as ResolvedUserConfig;

  // set internal config
  resolvedUserConfig.envMode = mode;

  if (configFilePath) {
    const dependencies = await traceDependencies(configFilePath, logger);
    dependencies.sort();
    resolvedUserConfig.configFileDependencies = dependencies;
    resolvedUserConfig.configFilePath = configFilePath;
  }

  const resolvedRootPath = resolvedUserConfig.root ?? process.cwd();
  const resolvedEnvPath = resolvedUserConfig.envDir
    ? resolvedUserConfig.envDir
    : resolvedRootPath;

  const userEnv = loadEnv(
    resolvedUserConfig.envMode ?? mode,
    resolvedEnvPath,
    resolvedUserConfig.envPrefix
  );
  const existsEnvFiles = getExistsEnvFiles(
    resolvedUserConfig.envMode ?? mode,
    resolvedEnvPath
  );

  resolvedUserConfig.envFiles = [
    ...(Array.isArray(resolvedUserConfig.envFiles)
      ? resolvedUserConfig.envFiles
      : []),
    ...existsEnvFiles
  ];

  resolvedUserConfig.env = {
    ...userEnv,
    NODE_ENV: userConfig.compilation.mode ?? mode,
    mode: mode
  };

  return resolvedUserConfig;
}

export async function normalizeUserCompilationConfig(
  resolvedUserConfig: ResolvedUserConfig,
  mode: CompilationMode = 'development',
  logger: Logger = new Logger(),
  isDefault = false
): Promise<ResolvedCompilation> {
  const { compilation, root = process.cwd(), clearScreen } = resolvedUserConfig;

  // resolve root path
  const resolvedRootPath = normalizePath(root);

  resolvedUserConfig.root = resolvedRootPath;

  if (!resolvedUserConfig.compilation) {
    resolvedUserConfig.compilation = {};
  }

  // if normalize default config, skip check input option
  const inputIndexConfig = !isDefault
    ? checkCompilationInputValue(resolvedUserConfig, logger)
    : {};

  const resolvedCompilation: ResolvedCompilation = merge(
    {},
    DEFAULT_COMPILATION_OPTIONS,
    {
      input: inputIndexConfig,
      root: resolvedRootPath
    },
    {
      clearScreen
    },
    compilation
  );

  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';
  resolvedCompilation.mode = resolvedCompilation.mode ?? mode;

  resolvedCompilation.coreLibPath = bindingPath;

  normalizeOutput(resolvedCompilation, isProduction, logger);
  normalizeExternal(resolvedUserConfig, resolvedCompilation);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore do not check type for this internal option
  if (!resolvedCompilation.assets?.publicDir) {
    resolvedCompilation.assets = resolvedCompilation.assets || {};
    const userPublicDir = resolvedUserConfig.publicDir
      ? resolvedUserConfig.publicDir
      : join(resolvedCompilation.root, 'public');

    resolvedCompilation.assets.publicDir = isAbsolute(userPublicDir)
      ? userPublicDir
      : join(resolvedCompilation.root, userPublicDir);
  }

  resolvedCompilation.define = Object.assign(
    {
      // skip self define
      ['FARM' + '_PROCESS_ENV']: resolvedUserConfig.env
    },
    resolvedCompilation?.define,
    // for node target, we should not define process.env.NODE_ENV
    resolvedCompilation.output?.targetEnv === 'node'
      ? {}
      : Object.keys(resolvedUserConfig.env || {}).reduce((env: any, key) => {
          env[`$__farm_regex:(global(This)?\\.)?process\\.env\\.${key}`] =
            JSON.stringify(resolvedUserConfig.env[key]);
          return env;
        }, {})
  );

  const require = module.createRequire(import.meta.url);
  const hmrClientPluginPath = require.resolve('@farmfe/runtime-plugin-hmr');
  const ImportMetaPluginPath = require.resolve(
    '@farmfe/runtime-plugin-import-meta'
  );

  if (!resolvedCompilation.runtime) {
    resolvedCompilation.runtime = {
      path: require.resolve('@farmfe/runtime'),
      plugins: []
    };
  }

  if (!resolvedCompilation.runtime.path) {
    resolvedCompilation.runtime.path = require.resolve('@farmfe/runtime');
  }

  if (!resolvedCompilation.runtime.swcHelpersPath) {
    resolvedCompilation.runtime.swcHelpersPath = path.dirname(
      require.resolve('@swc/helpers/package.json')
    );
  }

  if (!resolvedCompilation.runtime.plugins) {
    resolvedCompilation.runtime.plugins = [];
  } else {
    // make sure all plugin paths are absolute
    resolvedCompilation.runtime.plugins =
      resolvedCompilation.runtime.plugins.map((plugin: any) => {
        if (!path.isAbsolute(plugin)) {
          if (!plugin.startsWith('.')) {
            // resolve plugin from node_modules
            return require.resolve(plugin);
          } else {
            return path.resolve(resolvedRootPath, plugin);
          }
        }

        return plugin;
      });
  }
  // set namespace to package.json name field's hash
  if (!resolvedCompilation.runtime.namespace) {
    // read package.json name field
    const packageJsonPath = path.resolve(resolvedRootPath, 'package.json');
    const packageJsonExists = fse.existsSync(packageJsonPath);
    const namespaceName = packageJsonExists
      ? JSON.parse(fse.readFileSync(packageJsonPath, { encoding: 'utf-8' }))
          ?.name ?? FARM_DEFAULT_NAMESPACE
      : FARM_DEFAULT_NAMESPACE;

    resolvedCompilation.runtime.namespace = crypto
      .createHash('md5')
      .update(namespaceName)
      .digest('hex');
  }

  if (isProduction) {
    resolvedCompilation.lazyCompilation = false;
  } else if (resolvedCompilation.lazyCompilation === undefined) {
    resolvedCompilation.lazyCompilation = isDevelopment;
  }

  if (resolvedCompilation.mode === undefined) {
    resolvedCompilation.mode = mode;
  }
  setProcessEnv(resolvedCompilation.mode);
  // TODO add targetEnv `lib-browser` and `lib-node` support
  const is_entry_html =
    Object.keys(resolvedCompilation.input).length === 0 ||
    Object.values(resolvedCompilation.input).some((value: string) =>
      value.endsWith('.html')
    );
  if (
    resolvedCompilation.output.targetEnv !== 'node' &&
    isArray(resolvedCompilation.runtime.plugins) &&
    resolvedUserConfig.server?.hmr &&
    is_entry_html &&
    !resolvedCompilation.runtime.plugins.includes(hmrClientPluginPath)
  ) {
    const publicPath = getValidPublicPath(
      resolvedCompilation.output.publicPath
    );
    const serverOptions = resolvedUserConfig.server;
    const defineHmrPath = normalizePath(
      path.join(publicPath, resolvedUserConfig.server.hmr.path)
    );

    resolvedCompilation.runtime.plugins.push(hmrClientPluginPath);
    // TODO optimize get hmr logic
    resolvedCompilation.define.FARM_HMR_PORT = String(
      (serverOptions.hmr.port || undefined) ??
        serverOptions.port ??
        DEFAULT_DEV_SERVER_OPTIONS.port
    );
    resolvedCompilation.define.FARM_HMR_HOST = JSON.stringify(
      resolvedUserConfig.server.hmr.host
    );
    resolvedCompilation.define.FARM_HMR_PROTOCOL = JSON.stringify(
      resolvedUserConfig.server.hmr.protocol
    );
    resolvedCompilation.define.FARM_HMR_PATH = JSON.stringify(defineHmrPath);
  }

  if (
    isArray(resolvedCompilation.runtime.plugins) &&
    !resolvedCompilation.runtime.plugins.includes(ImportMetaPluginPath)
  ) {
    resolvedCompilation.runtime.plugins.push(ImportMetaPluginPath);
  }

  // we should not deep merge compilation.input
  if (compilation?.input && Object.keys(compilation.input).length > 0) {
    // Add ./ if userConfig.input is relative path without ./
    const input: Record<string, string> = {};

    for (const [key, value] of Object.entries(compilation.input)) {
      if (!value && (value ?? true)) continue;
      input[key] =
        !path.isAbsolute(value) && !value.startsWith('./')
          ? `./${value}`
          : value;
    }

    resolvedCompilation.input = input;
  }

  if (resolvedCompilation.treeShaking === undefined) {
    resolvedCompilation.treeShaking = isProduction;
  }

  if (resolvedCompilation.script?.plugins?.length) {
    logger.info(
      `Swc plugins are configured, note that Farm uses ${colors.yellow(
        'swc_core v0.96'
      )}, please make sure the plugin is ${colors.green(
        'compatible'
      )} with swc_core ${colors.yellow(
        'swc_core v0.96'
      )}. Otherwise, it may exit unexpectedly.`
    );
  }

  // lazyCompilation should be disabled in production mode
  // so, it only happens in development mode
  // https://github.com/farm-fe/farm/issues/962
  if (resolvedCompilation.treeShaking && resolvedCompilation.lazyCompilation) {
    logger.error(
      'treeShaking option is not supported in lazyCompilation mode, lazyCompilation will be disabled.'
    );
    resolvedCompilation.lazyCompilation = false;
  }

  if (resolvedCompilation.minify === undefined) {
    resolvedCompilation.minify = isProduction;
  }

  if (resolvedCompilation.presetEnv === undefined) {
    resolvedCompilation.presetEnv = isProduction;
  }

  // setting the custom configuration
  resolvedCompilation.custom = {
    ...(resolvedCompilation.custom || {}),
    [CUSTOM_KEYS.runtime_isolate]: `${!!resolvedCompilation.runtime.isolate}`
  };

  // Auto enable decorator by default when `script.decorators` is enabled
  if (resolvedCompilation.script?.decorators !== undefined)
    if (resolvedCompilation.script.parser === undefined) {
      resolvedCompilation.script.parser = {
        esConfig: {
          decorators: true
        },
        tsConfig: {
          decorators: true
        }
      };
    } else {
      if (resolvedCompilation.script.parser.esConfig !== undefined)
        resolvedCompilation.script.parser.esConfig.decorators = true;
      else
        resolvedCompilation.script.parser.esConfig = {
          decorators: true
        };
      if (resolvedCompilation.script.parser.tsConfig !== undefined)
        resolvedCompilation.script.parser.tsConfig.decorators = true;
      else
        resolvedUserConfig.compilation.script.parser.tsConfig = {
          decorators: true
        };
    }

  // normalize persistent cache at last
  await normalizePersistentCache(
    resolvedCompilation,
    resolvedUserConfig,
    logger
  );

  return resolvedCompilation;
}

function checkCompilationInputValue(userConfig: UserConfig, logger: Logger) {
  const { compilation } = userConfig;
  const targetEnv = compilation?.output?.targetEnv;
  const isTargetNode = targetEnv === 'node';
  const defaultHtmlPath = './index.html';
  let inputIndexConfig: { index?: string } = { index: '' };
  let errorMessage = '';

  // Check if input is specified
  if (!isEmptyObject(compilation?.input)) {
    inputIndexConfig = compilation?.input;
  } else {
    if (isTargetNode) {
      // If input is not specified, try to find index.js or index.ts
      const entryFiles = ['./index.js', './index.ts'];

      for (const entryFile of entryFiles) {
        try {
          if (fse.statSync(path.resolve(userConfig?.root, entryFile))) {
            inputIndexConfig = { index: entryFile };
            break;
          }
        } catch (error) {
          errorMessage = error.stack;
        }
      }
    } else {
      try {
        if (fse.statSync(path.resolve(userConfig?.root, defaultHtmlPath))) {
          inputIndexConfig = { index: defaultHtmlPath };
        }
      } catch (error) {
        errorMessage = error.stack;
      }
    }

    // If no index file is found, throw an error
    if (!inputIndexConfig.index) {
      logger.error(
        `Build failed due to errors: Can not resolve ${
          isTargetNode ? 'index.js or index.ts' : 'index.html'
        }  from ${userConfig.root}. \n${errorMessage}`,
        { exit: true }
      );
    }
  }

  return inputIndexConfig;
}
