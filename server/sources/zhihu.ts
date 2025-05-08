import { getHeaderCacheTable } from "../database/headerCache"

const id = "zhihu"
// 假设 myFetch 是封装的请求函数
async function myFetch(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, { headers })
  if (response.status === 401) {
    // 清理对应 id 的 header
    const headerCacheResult = await getHeaderCacheTable()
    if (headerCacheResult) {
      await headerCacheResult.setInvalid(id)
    }
    throw new Error("Unauthorized")
  }
  return response.json()
}

interface Res {
  data: {
    card_label?: {
      icon: string
      night_icon: string
    }
    target: {
      id: number
      title: string
      url: string
      created: number
      answer_count: number
      follower_count: number
      bound_topic_ids: number[]
      comment_count: number
      is_following: boolean
      excerpt: string
    }
  }[]
}

export default defineSource({
  zhihu: async () => {
    const headerCacheResult = await getHeaderCacheTable()
    let headers: Record<string, string> = {}
    if (headerCacheResult) {
      // 从 headerCacheTable 获取缓存的 header，get 方法返回的已经是解析后的 header 对象
      const source_url = "https://www.zhihu.com/hot"
      const cachedHeader = await headerCacheResult.get(id, source_url)
      if (cachedHeader) {
        headers = cachedHeader
      }
    }

    const url = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20&desktop=true"
    logger.warn(headers)
    const resData = await myFetch(url, headers)
    // 使用类型断言
    const res = resData as Res
    return res.data
      .map((k) => {
        const urlId = k.target.url?.match(/(\d+)$/)?.[1]
        return {
          id: k.target.id,
          title: k.target.title,
          extra: {
            icon: k.card_label?.night_icon && proxyPicture(k.card_label.night_icon),
          },
          url: `https://www.zhihu.com/question/${urlId || k.target.id}`,
        }
      })
  },
})
