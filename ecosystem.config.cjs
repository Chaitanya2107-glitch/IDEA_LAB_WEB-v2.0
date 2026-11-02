// Alternative to Docker: PM2 process file (`pm2 start ecosystem.config.cjs && pm2 save`).
// Needs MongoDB installed on the server; the app reads MONGODB_URI, STORAGE_DIR and the
// other settings from .env in this directory.
module.exports = {
  apps: [
    {
      name: 'idea-lab',
      script: 'build/server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      kill_timeout: 12000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
      },
    },
  ],
};
