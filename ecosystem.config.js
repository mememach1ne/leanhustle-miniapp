module.exports = {
  apps: [
    {
      name: 'api',
      cwd: '/opt/app/apps/api',
      script: 'src/main.ts',
      interpreter: '/opt/app/node_modules/.bin/tsx',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'web',
      cwd: '/opt/app/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'bot',
      cwd: '/opt/app/apps/bot',
      script: 'src/main.ts',
      interpreter: '/opt/app/node_modules/.bin/tsx',
      env: { NODE_ENV: 'production' },
    },
  ],
};
