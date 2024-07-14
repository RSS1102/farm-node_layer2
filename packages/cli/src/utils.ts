import type { build, clean, preview, start, watch } from '@farmfe/core';
import { Logger } from '@farmfe/core';

import type { GlobalFarmCLIOptions } from './types.js';

export const logger = new Logger();

export async function resolveCore(): Promise<{
  start: typeof start;
  build: typeof build;
  watch: typeof watch;
  preview: typeof preview;
  clean: typeof clean;
}> {
  try {
    return import('@farmfe/core');
  } catch (err) {
    logger.error(
      `Cannot find @farmfe/core module, Did you successfully install: \n${err.stack},`
    );
    process.exit(1);
  }
}

/**
 * filter duplicate item in options
 */
export function filterDuplicateOptions<T>(options: T) {
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      options[key as keyof T] = value[value.length - 1];
    }
  }
}

export function resolveCommandOptions(
  options: GlobalFarmCLIOptions
): GlobalFarmCLIOptions {
  const resolveOptions = { ...options };
  filterDuplicateOptions(resolveOptions);
  return cleanOptions(resolveOptions);
}

export async function handleAsyncOperationErrors<T>(
  asyncOperation: Promise<T>,
  errorMessage: string
) {
  try {
    await asyncOperation;
  } catch (error) {
    logger.error(`${errorMessage}:\n${error.stack}`);
    process.exit(1);
  }
}

export function cleanOptions(options: GlobalFarmCLIOptions) {
  const resolveOptions = { ...options };

  delete resolveOptions['--'];
  delete resolveOptions.m;
  delete resolveOptions.c;
  delete resolveOptions.w;
  delete resolveOptions.l;
  delete resolveOptions.lazy;
  delete resolveOptions.mode;
  delete resolveOptions.base;
  delete resolveOptions.config;
  delete resolveOptions.clearScreen;

  return resolveOptions;
}
