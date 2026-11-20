/**
 * Public bilibili web-API helpers.
 *
 * Only reads publicly visible data (search results and video metadata).
 * A buvid3 cookie is fetched from the homepage once and reused, because the
 * search endpoint returns -412 without one.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

let cookieCache = null
let cookieAt = 0
const COOKIE_TTL_MS = 30 * 60 * 1000

/** Strip the highlight markup bilibili puts inside search titles. */
export function cleanTitle(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/** Parse "MM:SS" / "H:MM:SS" into seconds. */
export function parseClock(text) {
  const parts = String(text || '').split(':').map((x) => Number(x))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** Format seconds as "HhMMm" / "MMm". */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
}

/** True when a title/description looks like a paid-course funnel rather than a full free course. */
const CONTACT_PATTERN = new RegExp([
  // 直接给联系方式
  '加\\s*[薇微VvXxQq]', '➕\\s*[薇微VvXx]', '[＋+]\\s*[薇微VvXxQq]',
  '薇信', '威信', 'vx', 'weixin', 'qq\\s*群', '企鹅号',
  '薇\\s*[:：]', '微\\s*[:：]', '[＋+]\\s*[Qq]\\s*[:：]?',
  // 只露出"完整版"然后引导私聊 —— 标题看不出，简介里常见
  '完整版.{0,8}(滴滴|私聊|私信|联系|咨询|找我|详询)',
  '滴滴我', '(加|联系|找)\\s*助教', '私信我', '加我',
].join('|'))

/**
 * True when a title/description/page name carries a paid-course contact funnel
 * (微信/QQ 引流、"完整版加薇"之类), which means the public upload is a teaser.
 */
export function looksLikeFunnel(...texts) {
  const blob = texts.filter(Boolean).join(' ')
  return CONTACT_PATTERN.test(blob)
}

async function getCookie() {
  if (cookieCache && Date.now() - cookieAt < COOKIE_TTL_MS) return cookieCache
  try {
    const res = await fetch('https://www.bilibili.com/', {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
    })
    const raw = res.headers.getSetCookie?.() ?? []
    const pairs = raw.map((c) => c.split(';')[0]).filter((c) => /=/.test(c))
    cookieCache = pairs.join('; ')
  } catch {
    cookieCache = ''
  }
  cookieAt = Date.now()
  return cookieCache
}

async function api(path, params) {
  const query = new URLSearchParams(params).toString()
  const url = `https://api.bilibili.com${path}?${query}`
  const cookie = await getCookie()
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://search.bilibili.com/',
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`bilibili returned non-JSON (HTTP ${res.status})`)
  }
  if (data.code !== 0) {
    if (data.code === -412) {
      cookieCache = null
      throw new Error('bilibili rate-limited this request (-412); wait a moment and retry with fewer results')
    }
    throw new Error(`bilibili API error ${data.code}: ${data.message || 'unknown'}`)
  }
  return data.data
}

/**
 * Search public videos.
 * @param {string} keyword
 * @param {{ limit?: number, page?: number, order?: string }} options
 *   order: totalrank (default) | click (most played) | pubdate (newest) | dm (most danmaku)
 */
export async function searchVideos(keyword, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 15, 1), 50)
  const page = Math.max(Number(options.page) || 1, 1)
  const data = await api('/x/web-interface/search/type', {
    search_type: 'video',
    keyword,
    page,
    order: options.order || 'totalrank',
  })
  const list = Array.isArray(data?.result) ? data.result : []
  const items = []
  for (const item of list) {
    if (!item || !item.bvid) continue
    items.push({
      bvid: item.bvid,
      title: cleanTitle(item.title),
      up: item.author || '',
      play: Number(item.play) || 0,
      danmaku: Number(item.video_review) || 0,
      favorite: Number(item.favorites) || 0,
      durationSeconds: parseClock(item.duration),
      durationText: formatDuration(parseClock(item.duration)),
      pubdate: Number(item.pubdate) || 0,
      url: `https://www.bilibili.com/video/${item.bvid}/`,
      description: cleanTitle(item.description || '').slice(0, 160),
      likelyFunnel: looksLikeFunnel(item.title, item.description || ''),
    })
    if (items.length >= limit) break
  }
  return { keyword, page, total: Number(data?.numResults) || items.length, items }
}

/**
 * Fetch one video's metadata and its full page (分P) list.
 * @param {string} bvid
 * @param {{ maxPages?: number }} options  maxPages caps how many pages are returned (default 60)
 */
export async function fetchVideo(bvid, options = {}) {
  const id = String(bvid || '').trim()
  if (!/^BV[0-9A-Za-z]{10}$/.test(id)) throw new Error(`not a bvid: ${id}`)
  const data = await api('/x/web-interface/view', { bvid: id })
  const pages = Array.isArray(data.pages) ? data.pages : []
  const maxPages = Math.min(Math.max(Number(options.maxPages) || 60, 1), 500)
  const shown = pages.slice(0, maxPages).map((p) => ({
    index: p.page,
    title: String(p.part || ''),
    durationSeconds: Number(p.duration) || 0,
    durationText: formatDuration(p.duration),
  }))
  return {
    bvid: id,
    title: String(data.title || ''),
    up: String(data.owner?.name || ''),
    upMid: Number(data.owner?.mid) || 0,
    totalSeconds: Number(data.duration) || 0,
    totalText: formatDuration(data.duration),
    pageCount: pages.length,
    pagesShown: shown.length,
    pages: shown,
    play: Number(data.stat?.view) || 0,
    favorite: Number(data.stat?.favorite) || 0,
    pubdate: Number(data.pubdate) || 0,
    description: String(data.desc || '').slice(0, 400),
    url: `https://www.bilibili.com/video/${id}/`,
    likelyFunnel: looksLikeFunnel(data.title, data.desc, ...shown.map((p) => p.title)),
  }
}


/* -------------------------------------------------- course classification ---- */

const CRASH_WORDS = /速成|速通|突击|期末|考前|救命|急救|抱佛脚|三小时|3小时|两小时|2小时|一小时|1小时|几天搞定|小时搞定|速学/
const SYSTEM_WORDS = /全套|系统|精讲|全\s*\d+\s*讲|零基础(?!速成)|完整|从入门|体系|全程班|逐章|章节精讲/

/**
 * Classify a candidate by title and total duration only.
 * Search results carry no page count, so this is a first pass; bili_course
 * confirms with the real page list.
 * @param {string} title
 * @param {number} seconds total duration in seconds
 * @returns {'system'|'crash'|'unknown'}
 */
export function classifyCourse(title, seconds) {
  const t = String(title || '')
  const s = Number(seconds) || 0
  const hours = s / 3600
  const crashWord = CRASH_WORDS.test(t)
  const systemWord = SYSTEM_WORDS.test(t)
  if (crashWord && hours <= 8) return 'crash'
  if (systemWord && hours >= 6) return 'system'
  if (hours >= 12) return 'system'
  if (hours > 0 && hours <= 3) return 'crash'
  if (systemWord) return 'system'
  if (crashWord) return 'crash'
  return 'unknown'
}

/**
 * Score one candidate for a learning goal and a preferred style.
 * Higher is better. Pure and deterministic so the same input always ranks the same.
 * @param {{title: string, durationSeconds: number, play: number}} item
 * @param {{goal?: string, style?: string}} options
 * @returns {{score: number, kind: string, reason: string}}
 */
export const LEVELS = [
  {
    id: 'primary', label: '小学', suffixes: ['小学'],
    include: /小学|小升初|[一二三四五六]年级/, exclude: /考研|专升本|大学|高考|中考|成人高考/,
    bias: 'system',
  },
  {
    id: 'junior', label: '初中', suffixes: ['初中'],
    include: /初中|中考|初一|初二|初三|[七八九年级]/, exclude: /考研|专升本|大学|小学|高考/,
    bias: 'system',
  },
  {
    id: 'senior', label: '高中', suffixes: ['高中'],
    include: /高中|高考|高一|高二|高三|必修|选修/, exclude: /考研|专升本|大学|小学|初中|中考/,
    bias: 'system',
  },
  {
    id: 'college', label: '大学期末', suffixes: ['期末', '大学'],
    include: /期末|大学|专业课|专业课考试|挂科/, exclude: /考研|专升本|小学|初中|高中|高考|中考/,
    bias: 'crash',
  },
  {
    id: 'zhuanshengben', label: '专升本', suffixes: ['专升本'],
    include: /专升本|专插本|专转本|专接本|升本/, exclude: /考研|高考|中考|小学|初中|高中|公务员/,
    bias: 'system',
  },
  {
    id: 'kaoyan', label: '考研', suffixes: ['考研'],
    include: /考研|研究生|初试|复试|统考/, exclude: /专升本|高考|中考|小学|初中|高中|公务员/,
    bias: 'system',
  },
  {
    id: 'gongkao', label: '考公考编', suffixes: ['公务员', '事业编'],
    include: /公务员|公考|事业编|省考|国考|行测|申论|事业单位|选调/, exclude: /考研|专升本|高考|中考|小学|初中/,
    bias: 'crash',
  },
  {
    id: 'zige', label: '职业资格', suffixes: ['资格证'],
    include: /资格|证书|执业|初级|中级|注会|法考|教资|教师资格/, exclude: /考研|专升本|高考|中考|小学|初中/,
    bias: 'system',
  },
  {
    id: 'zixue', label: '兴趣自学', suffixes: [],
    include: null, exclude: /考研|专升本|高考|中考|小学|初中|高中|公务员|事业编/,
    bias: 'system',
  },
]

/** Resolve a level id, falling back to the free-form one. */
export function getLevel(id) {
  return LEVELS.find((x) => x.id === id) || LEVELS.find((x) => x.id === 'zixue')
}

/**
 * How well a title matches the searched subject. 1 = contains the whole
 * keyword, 0.6 = contains a 2-4 character fragment, 0.15 = barely related.
 * @param {string} title
 * @param {string} keyword
 * @returns {number}
 */
export function relevanceScore(title, keyword) {
  const t = String(title || '').toLowerCase()
  const k = String(keyword || '').toLowerCase().trim()
  if (!k) return 1
  if (t.includes(k)) return 1
  const parts = []
  for (let n = Math.min(4, k.length); n >= 2; n--) {
    for (let i = 0; i + n <= k.length; i++) parts.push(k.slice(i, i + n))
  }
  let hits = 0
  for (const p of parts) if (t.includes(p)) hits++
  if (hits === 0) return 0.15
  // 只蹭到一个两字词（“零基础”里的“基础”）不算相关，否则同音不同科都会混进来。
  return hits >= 2 ? 0.6 : 0.2
}

/**
 * Score one candidate for a learning level and a preferred style.
 * @param {{title: string, durationSeconds: number, play: number, likelyFunnel?: boolean, description?: string}} item
 * @param {{level?: string, style?: string, keyword?: string}} options
 * @returns {{score: number, kind: string, reason: string, relevant: number, offLevel: boolean}}
 */
export function scoreCourse(item, options = {}) {
  const kind = classifyCourse(item.title, item.durationSeconds)
  const hours = (Number(item.durationSeconds) || 0) / 3600
  const level = getLevel(options.level)
  const style = options.style === 'system' || options.style === 'crash' ? options.style : 'any'
  const title = String(item.title || '')
  const blob = title + ' ' + String(item.description || '')

  const relevant = relevanceScore(title, options.keyword || '')
  let score = Math.log10((Number(item.play) || 0) + 10) * 5
  let reason = ''

  // 学段匹配：命中 include 加分，命中 exclude 大幅扣分
  let offLevel = false
  if (level.include) {
    // 标题里直接写对学段的才算真对口；只有简介提到（“适用于专升本”这种万能话术）给得少；
    // 完全不提的，多半是通识课，压下去。
    const titleHit = level.include.test(title)
    const blobHit = level.include.test(blob)
    score += titleHit ? 18 : blobHit ? 4 : -16
  }
  if (level.exclude && level.exclude.test(blob)) { score -= 34; offLevel = true }

  if (kind === 'system') {
    score += level.bias === 'system' ? 22 : 12
    reason = hours >= 12 ? '长课时系统课，适合打底' : '分章节体系课'
  } else if (kind === 'crash') {
    score += level.bias === 'crash' ? 18 : -6
    reason = level.bias === 'crash' ? '速通向，适合考前突击' : '速通向，不适合系统学习'
  } else {
    score += 4
    reason = '类型不明确，需看分P确认'
  }

  if (style === 'system' && kind === 'crash') score -= 40
  if (style === 'crash' && kind === 'system') score -= 12

  score += relevant * 26
  if (relevant < 0.6) reason = '与搜索词相关性弱'
  if (offLevel) reason = '学段不匹配（' + level.label + '）'
  if (item.likelyFunnel) { score -= 45; reason = '疑似付费引流，公开部分不完整' }

  return { score: Math.round(score * 10) / 10, kind, reason, relevant, offLevel }
}



/* ------------------------------------------------------- page-level audit ---- */

const AD_PAGE = /加\s*[薇微Vv]|➕\s*[薇微Vv]|[＋+]\s*[薇微Vv]|薇信|vx|扫码|公众号|加群|qq群|企鹅|私信我|联系老师|网盘/

/**
 * Audit one course by its real page list, to catch uploads whose title looks
 * like a full course but whose pages are filler or ads.
 * @param {{title?: string, description?: string, totalSeconds?: number, pages?: Array<{title: string, durationSeconds: number}>, likelyFunnel?: boolean}} info
 * @returns {{penalty: number, suspicious: boolean, reasons: string[], pageCount: number, avgSeconds: number}}
 */
export function auditCourse(info) {
  const pages = Array.isArray(info.pages) ? info.pages : []
  const reasons = []
  let penalty = 0

  if (info.likelyFunnel) { penalty += 40; reasons.push('标题或简介命中引流词') }

  // 集数太少就是试听切片 —— 但单个超长视频（4 小时以上）是完整课，不算。
  const singleLong = pages.length === 1 && (Number(info.totalSeconds) || 0) > 4 * 3600
  if (pages.length > 0 && pages.length <= 3 && !singleLong) {
    penalty += 30
    reasons.push('只有 ' + pages.length + ' 集，是试听切片不是全集')
  } else if (pages.length > 3 && pages.length <= 8) {
    penalty += 12
    reasons.push('分P偏少（' + pages.length + ' 集）')
  }

  if (pages.length >= 5) {
    const unique = new Set(pages.map((p) => String(p.title || '').trim())).size
    if (unique / pages.length < 0.5) { penalty += 25; reasons.push('分P标题大量重复') }
  }

  // 用已取回分P自己的时长算平均：课程被截断时 totalSeconds 是全长，会算出虚高。
  const pageTotal = pages.reduce((a, p) => a + (Number(p.durationSeconds) || 0), 0)
  const avg = pages.length ? pageTotal / pages.length : 0
  if (pages.length >= 5 && avg < 180) { penalty += 20; reasons.push('平均每集不足 3 分钟') }

  const adPages = pages.filter((p) => AD_PAGE.test(String(p.title || ''))).length
  if (adPages > 0) {
    penalty += 15 * Math.min(adPages, 2)
    reasons.push(adPages + ' 集分P名含引流提示')
  }

  if (String(info.description || '').trim().length < 20) { penalty += 5; reasons.push('简介信息极少') }

  return { penalty, suspicious: penalty >= 25, reasons, pageCount: pages.length, avgSeconds: Math.round(avg) }
}
