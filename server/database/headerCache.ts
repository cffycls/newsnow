import process from "node:process"
import type { Database } from "db0"
import type { HeaderCacheRow } from "../types"

export class HeaderCache {
  private db
  constructor(db: Database) {
    this.db = db
  }

  /**
   * 初始化 header 缓存表，如果表不存在则创建
   */
  async init() {
    try {
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS header_cache (
          id TEXT PRIMARY KEY,
          updated DATETIME,
          source_url TEXT,
          header TEXT
        );
      `).run()
      logger.success(`init header cache table`)
    } catch (error) {
      logger.error(`Failed to init header cache table`, error)
    }
  }

  /**
   * 设置指定 key 的 header 缓存
   * @param key - 缓存的键
   * @param header - 要缓存的 header 对象
   */
  async set(key: string, header: Record<string, string>) {
    try {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ")
      await this.db.prepare(
        `INSERT OR REPLACE INTO header_cache (id, header, source_url, updated) VALUES (?, ?, ?, ?)`,
      ).run(key, JSON.stringify(header), "", now)
      logger.success(`set ${key} header cache`)
    } catch (error) {
      logger.error(`Failed to set ${key} header cache`, error)
    }
  }

  /**
   * 获取指定 key 的 header 缓存
   * @param key - 缓存的键
   * @returns 解析后的 header 对象，如果不存在则返回 undefined
   */
  async get(key: string, source_url: string): Promise<Record<string, string> | undefined> {
    try {
      const row = (await this.db.prepare(`SELECT header, updated FROM header_cache WHERE id = ?`).get(key)) as HeaderCacheRow | undefined
      if (row) {
        logger.success(`get ${key} header cache`)
        return JSON.parse(row.header)
      } else {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ")
        await this.db.prepare(
          `INSERT INTO header_cache (id, header, source_url, updated) VALUES (?, ?, ?, ?)`,
        ).run(key, "", source_url, now)
        return undefined
      }
    } catch (error) {
      logger.error(`Failed to get ${key} header cache`, error)
    }
  }

  /**
   * 批量获取多个 key 的 header 缓存
   * @param keys - 缓存键的数组
   * @returns 包含多个 header 缓存信息的数组
   */
  async getEntire(keys: string[]): Promise<Record<string, string>[]> {
    try {
      const keysStr = keys.map(k => `id = '${k}'`).join(" or ")
      const sql = `SELECT header, updated FROM header_cache WHERE ${keysStr}`
      const res = await this.db.prepare(sql).all() as any
      const rows = (res.results ?? res) as HeaderCacheRow[]

      if (rows?.length) {
        logger.success(`get entire header cache`)
        return rows.map(row => JSON.parse(row.header))
      }
      return []
    } catch (error) {
      logger.error(`Failed to get entire header cache`, error)
      return []
    }
  }

  /**
   * 将指定 key 的 header 缓存标记为无效
   * @param key - 缓存的键
   */
  async setInvalid(key: string) {
    try {
      return await this.db.prepare(`UPDATE header_cache SET header='' WHERE id = ?`).run(key)
    } catch (error) {
      logger.error(`Failed to set ${key} header cache as invalid`, error)
    }
  }

  /**
   * 删除指定 key 的 header 缓存
   * @param key - 缓存的键
   */
  async delete(key: string) {
    try {
      return await this.db.prepare(`DELETE FROM header_cache WHERE id = ?`).run(key)
    } catch (error) {
      logger.error(`Failed to delete ${key} header cache`, error)
    }
  }
}

/**
 * 获取 HeaderCache 实例
 * @returns HeaderCache 实例，如果缓存功能被禁用则返回 undefined
 */
export async function getHeaderCacheTable() {
  try {
    const db = useDatabase()
    // logger.info("db: ", db.getInstance())
    if (process.env.ENABLE_CACHE === "false") return
    const headerCacheTable = new HeaderCache(db)
    if (process.env.INIT_TABLE !== "false") await headerCacheTable.init()
    return headerCacheTable
  } catch (e) {
    logger.error("failed to init header cache database ", e)
  }
}
