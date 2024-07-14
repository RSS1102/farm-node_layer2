export * from '../utils/index.js';

// import { statSync } from "node:fs";
// import path from "node:path";
// import fse from "fs-extra";
import { Logger } from '../utils/logger.js';
import { resolveConfig } from './config/index.js';

export async function start(inlineConfig?: any): Promise<void> {
  inlineConfig = inlineConfig ?? {};
  const logger = inlineConfig.logger ?? new Logger();

  try {
    await resolveConfig(inlineConfig, 'start', 'development', 'development');
    // const compiler = await createCompiler(resolvedUserConfig, logger);

    // const devServer = await createDevServer(
    //   compiler,
    //   resolvedUserConfig,
    //   logger,
    // );

    // await devServer.listen();
  } catch (error) {
    logger.error('Failed to start the server', { exit: true, error });
  }
}
