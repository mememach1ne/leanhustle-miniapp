import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const collectAncestors = (startPath: string) => {
  const ancestors: string[] = [];
  let current = path.resolve(startPath);

  for (let index = 0; index < 8; index += 1) {
    ancestors.push(current);
    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return ancestors;
};

const loadEnvFiles = () => {
  const candidatePaths = [
    ...collectAncestors(process.cwd()).flatMap((directory) => [
      path.join(directory, '.env'),
      path.join(directory, 'apps', 'bot', '.env'),
    ]),
    ...collectAncestors(currentDirectory).flatMap((directory) => [
      path.join(directory, '.env'),
      path.join(directory, 'apps', 'bot', '.env'),
    ]),
  ];

  for (const envFilePath of Array.from(new Set(candidatePaths))) {
    if (!fs.existsSync(envFilePath)) {
      continue;
    }

    dotenv.config({
      path: envFilePath,
      override: false,
    });
  }
};

loadEnvFiles();

export const botEnv = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? '',
  internalApiToken: process.env.BOT_INTERNAL_API_TOKEN ?? '',
  apiUrl:
    process.env.BOT_API_URL ??
    `http://localhost:${process.env.API_PORT ?? process.env.PORT ?? 3001}/api`,
  logLevel: process.env.BOT_LOG_LEVEL ?? 'info',
};
