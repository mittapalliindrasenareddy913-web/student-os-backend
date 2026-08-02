module.exports = {
  apps: [
    {
      name: 'campus-os-backend',
      script: 'index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
