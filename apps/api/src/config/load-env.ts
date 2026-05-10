import dotenv from 'dotenv';

import { getEnvFilePaths } from './env-file-paths';

for (const envFilePath of getEnvFilePaths()) {
  dotenv.config({
    path: envFilePath,
    override: false,
  });
}
