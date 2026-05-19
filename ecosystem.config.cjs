const projectRoot = process.cwd();
module.exports = {
  apps : [{
    name: "gis-expert",
    script: "/home/admin/.bun/bin/bun",
    args: "src/app/server.ts",
    cwd: projectRoot,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env_production: {
      NODE_ENV: process.env.NODE_ENV ||  "production",
      PORT: process.env.PORT || "3101",
      DB_PATH: process.env.DB_PATH || "./course.sqlite",
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
    }
  }]
};
