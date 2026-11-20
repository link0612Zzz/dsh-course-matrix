/**
 * Syllabus parsing and syllabus-to-course-page matching.
 *
 * The matcher is deliberately lexical: it extracts distinctive tokens from one
 * syllabus line (Chinese n-grams plus Latin abbreviations such as PEST/SWOT/GDP)
 * and scores them against page titles. It cannot understand paraphrase, so the
 * score is exposed for a human to judge — it never claims a match it did not find.
 */

/** Lines that start a section, e.g. "1 管理基础知识" / "1．计划" / "第一章 组织". */
const SECTION_RE = /^\s*(?:第[一二三四五六七八九十]+[章节部分]|[（(]?[一二三四五六七八九十]+[）)、.]|\d+\s*[．.、]?\s*)(.*\S)\s*$/
/** Lines that start an item, e.g. "(1) 掌握…" / "（2）了解…" / "第1条". */
const ITEM_RE = /^\s*(?:[（(]\d+[）)]|\d+[）)]|\d+\.\d+(?:\.\d+)*|[①-⑳])\s*(.*\S)\s*$/

/** Characters that carry no matching signal. */
const NOISE_RE = /[，。、；：！？""''（）()《》\[\]【】…—·,.;:!?"'`~\s]/g

/**
 * Extract matchable tokens from one syllabus line.
 * @param {string} text
 * @returns {string[]} unique tokens, longest first
 */
export function extractTokens(text) {
  const clean = String(text || '').replace(NOISE_RE, ' ')
  const tokens = new Set()

  // Latin abbreviations and product names (PEST, SWOT, GDP, B2B, MBO…)
  for (const m of clean.matchAll(/[A-Z]{2,6}/g)) tokens.add(m[0].toLowerCase())
  for (const m of clean.matchAll(/\b[A-Za-z]\d[A-Za-z0-9]{0,4}\b/g)) tokens.add(m[0].toLowerCase())

  // Chinese runs: emit 4,3,2-gram windows, but rely on longer ones for signal.
  for (const run of clean.split(/\s+/)) {
    const chars = run.replace(/[^\u4e00-\u9fa5]/g, '')
    if (chars.length < 2) continue
    const max = Math.min(4, chars.length)
    for (let n = max; n >= 2; n--) {
      for (let i = 0; i + n <= chars.length; i++) tokens.add(chars.slice(i, i + n))
    }
  }
  return Array.from(tokens).sort((a, b) => b.length - a.length)
}

/**
 * Score how well one page title matches one syllabus line.
 * @param {string} title
 * @param {string[]} tokens
 * @returns {{hits: number, score: number, matched: string[]}}
 */
export function matchPage(title, tokens) {
  const t = String(title || '').toLowerCase()
  const matched = []
  let weight = 0
  for (const token of tokens) {
    if (t.includes(token)) {
      matched.push(token)
      weight += token.length >= 3 ? 3 : token.length === 2 ? 1 : 0.6
    }
  }
  // 只保留信息量最大的词：被更长命中词包含的短词（“管理”之于“管理者”）不单列。
  const concise = matched.filter(function (w) {
    return !matched.some(function (o) { return o !== w && o.includes(w) })
  })
  return { hits: matched.length, score: weight, matched: concise.slice(0, 4) }
}

/**
 * Parse plain syllabus text into sections and their items.
 * Tolerant by design: unrecognised lines attach to the current section, and a
 * document with no markers becomes one section of paragraph lines.
 * @param {string} text
 * @returns {Array<{title: string, items: string[]}>}
 */
export function parseSyllabus(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)

  const sections = []
  let current = null
  let currentModule = ''

  for (const line of lines) {
    const itemMatch = line.match(ITEM_RE)
    if (itemMatch) {
      const body = itemMatch[1].trim()
      if (!body) continue
      if (!current) {
        current = { title: '未分组', items: [] }
        sections.push(current)
      }
      current.items.push(body)
      continue
    }

    // “必修一 分子与细胞”这类教材模块名：记下来当后续章节的前缀，
    // 不单独成章（它自己没有条目，成章会被空条目过滤掉）。
    if (/^(必修|选修|模块)[一二三四五六七八九十]/.test(line) && line.length <= 30) {
      currentModule = line
      current = null
      continue
    }

    const sectionMatch = line.match(SECTION_RE)
    if (sectionMatch) {
      const title = (sectionMatch[1] || line).trim()
      // 章节标题通常很短；太长的句子更像是一条要求，归到条目里。
      if (title.length <= 30 && !/[，。；]/.test(title)) {
        current = { title: currentModule ? currentModule + ' · ' + title : title, items: [] }
        sections.push(current)
        continue
      }
    }

    if (!current) {
      current = { title: '未分组', items: [] }
      sections.push(current)
    }
    if (line.length <= 60) current.items.push(line)
    else {
      // 长段按句号切开，避免一条顶一整段。
      for (const part of line.split(/[。；]/)) {
        const p = part.trim()
        if (p) current.items.push(p)
      }
    }
  }

  return sections
    .map((s) => ({ title: s.title, items: s.items.filter((x) => x.length > 0) }))
    .filter((s) => s.items.length > 0)
}

/** Format seconds as "HhMMm" / "MMm". */
function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? h + 'h' + String(m).padStart(2, '0') + 'm' : m + 'm'
}

/**
 * Build the syllabus-to-page table.
 *
 * Every page of every collected course joins one pool, so a syllabus line may
 * be answered by a course that only covers a slice of the subject — that is the
 * point: primary courses carry the outline, supplementary ones fill the gaps.
 * Each line keeps at most two pages per course and five pages in total.
 *
 * @param {Array<{title: string, items: string[]}>} sections
 * @param {Array<{bvid: string, title: string, up: string, pages: Array<{index: number, title: string, durationSeconds: number, durationText: string}>, role?: string, fromSection?: string}>} courses
 * @returns {Array<{section: string, item: string, matches: Array<{course: string, bvid: string, page: number, pageTitle: string, duration: string, at: string, score: number, matched: string[], role: string, coursePages: number}>}>}
 */
export function buildMatrix(sections, courses) {
  const pool = []
  for (const course of courses) {
    let acc = 0
    for (const page of course.pages || []) {
      const seconds = Number(page.durationSeconds) || 0
      pool.push({
        course: course.title,
        bvid: course.bvid,
        up: course.up || '',
        fromSections: course.fromSections || [],
        coursePages: (course.pages || []).length,
        page: page.index,
        pageTitle: page.title,
        duration: page.durationText,
        // 这一集在整门课里的起点，方便直接拖进度条
        at: clock(acc),
      })
      acc += seconds
    }
  }

  const rows = []
  for (const section of sections) {
    for (const item of section.items) {
      const tokens = extractTokens(item)
      const scored = pool
        .map((p) => {
          const m = matchPage(p.pageTitle + ' ' + p.course, tokens)
          // 被本章标题搜出来、且集数够撑一章的，才算本章主课；
          // 其余一律按补充课列出来，只做参考。
          const substantial = (p.coursePages || 0) >= 20
          const fromThis = p.fromSections.indexOf(section.title) >= 0
          const role = (fromThis && substantial) ? 'primary' : 'supplementary'
          return { ...p, ...m, role }
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          // 同分时主课优先，再按课程体量大的优先
          const rank = (x) => (x.role === 'primary' ? 1 : 0)
          if (rank(b) !== rank(a)) return rank(b) - rank(a)
          return b.coursePages - a.coursePages
        })

      const perCourse = new Map()
      const picks = []
      for (const s of scored) {
        const used = perCourse.get(s.bvid) || 0
        if (used >= 2) continue
        perCourse.set(s.bvid, used + 1)
        picks.push(s)
        if (picks.length >= 5) break
      }

      rows.push({
        section: section.title,
        item,
        matches: picks.map((m) => ({
          course: m.course,
          bvid: m.bvid,
          page: m.page,
          pageTitle: m.pageTitle,
          duration: m.duration,
          at: m.at,
          score: m.score,
          matched: m.matched,
          role: m.role,
          coursePages: m.coursePages,
        })),
      })
    }
  }
  return rows
}
