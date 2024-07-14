export interface GlobalFarmCLIOptions {
  '--'?: string[];
  c?: boolean | string;
  config?: string;
  configPath?: string;
  m?: string;
  base?: string;
  mode?: 'development' | 'production';
  w?: boolean;
  watch?: boolean;
  watchPath?: string;
  port?: number;
  lazy?: boolean;
  l?: boolean;
  clearScreen?: boolean;
}

export interface ICleanOptions {
  path?: string;
  recursive?: boolean;
}

export interface FarmCLIServerOptions {
  port?: string;
  open?: boolean;
  https?: boolean;
  hmr?: boolean;
  strictPort?: boolean;
}

export interface FarmCLIBuildOptions {
  input?: string;
  outDir?: string;
  sourcemap?: boolean;
  minify?: boolean;
  treeShaking?: boolean;
  format?: 'cjs' | 'esm';
  target?:
    | 'browser'
    | 'node'
    | 'node16'
    | 'node-legacy'
    | 'node-next'
    | 'browser-legacy'
    | 'browser-es2015'
    | 'browser-es2017'
    | 'browser-esnext';
}

export interface FarmCLIPreviewOptions {
  host?: string | boolean;
  port?: number;
  open?: boolean | string;
  strictPort?: boolean;
  outDir?: string;
}
