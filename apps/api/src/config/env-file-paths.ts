import fs from 'fs';
import path from 'path';

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

export const getEnvFilePaths = () => {
  const candidatePaths = [
    ...collectAncestors(process.cwd()).flatMap((directory) => [
      path.join(directory, '.env'),
      path.join(directory, 'apps', 'api', '.env'),
    ]),
    ...collectAncestors(__dirname).flatMap((directory) => [
      path.join(directory, '.env'),
      path.join(directory, 'apps', 'api', '.env'),
    ]),
  ];

  return Array.from(new Set(candidatePaths)).filter((filePath) => fs.existsSync(filePath));
};
