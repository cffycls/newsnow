import process from "node:process"
import { join } from "node:path"
import viteNitro from "vite-plugin-with-nitro"
import { RollopGlob } from "./tools/rollup-glob"
import { projectDir } from "./shared/dir"

const nitroOption: Parameters<typeof viteNitro>[0] = {
  experimental: {
    database: true,
  },
  rollupConfig: {
    plugins: [RollopGlob()],
  },
  sourceMap: false,
  database: {
    default: {
      connector: "better-sqlite3",
      // 明确指定数据库路径
      options: {
        path: process.env.DATABASE_PATH || "./newsnow.db",
      },
    },
  },
  imports: {
    dirs: ["server/utils", "shared"],
  },
  preset: "node-server",
  alias: {
    "@shared": join(projectDir, "shared"),
    "#": join(projectDir, "server"),
  },
  // 从环境变量读取端口，若未设置则使用默认端口 3000
  server: {
    port: Number.parseInt(process.env.PORT || "3000", 10),
  },
}

if (process.env.VERCEL) {
  nitroOption.preset = "vercel-edge"
  // You can use other online database, do it yourself. For more info: https://db0.unjs.io/connectors
  nitroOption.database = undefined
  // nitroOption.vercel = {
  //   config: {
  //     cache: []
  //   },
  // }
} else if (process.env.CF_PAGES) {
  nitroOption.preset = "cloudflare-pages"
  nitroOption.unenv = {
    alias: {
      "safer-buffer": "node:buffer",
    },
  }
  nitroOption.database = {
    default: {
      connector: "cloudflare-d1",
      options: {
        bindingName: "NEWSNOW_DB",
      },
    },
  }
} else if (process.env.BUN) {
  nitroOption.preset = "bun"
  nitroOption.database = {
    default: {
      connector: "bun-sqlite",
    },
  }
}

export default function () {
  return viteNitro(nitroOption)
}
