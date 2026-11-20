/**
 * course-matrix — a DSH plugin that turns a subject name into a course table.
 *
 * Tools:
 *  - bili_search         search public bilibili videos for a subject
 *  - bili_course         read one video's full page (分P) list
 *  - course_matrix_xlsx  write a styled multi-sheet .xlsx without dependencies
 *
 * Imports only node: builtins and local modules, so the bundle activates from a
 * linked workspace directory without resolving Harness packages.
 */
import fs from 'node:fs'
import path from 'node:path'
import { searchVideos, fetchVideo, classifyCourse, scoreCourse, getLevel, auditCourse } from './lib/bili.js'
import { buildXlsx } from './lib/xlsx.js'
import { parseSyllabus, buildMatrix } from './lib/syllabus.js'

export const name = 'course-matrix'
export const inject = ['tools']

const FALLBACK_SEARCH_LIMIT = 15

function resolveOut(target) {
  const abs = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  return abs
}

function text(block) {
  return { type: 'text', text: block }
}

export function apply(ctx, config) {
  const defaultLimit = Math.min(Math.max(Number(config?.defaultSearchLimit) || FALLBACK_SEARCH_LIMIT, 1), 50)

  ctx.tools.register({
    name: 'bili_search',
    description:
      'Search public bilibili videos for a subject or course name and return ranked candidates '
      + '(title, uploader, play count, duration, bvid, url). Use it to discover candidate courses '
      + 'before checking one in detail with bili_course. Read-only; no login needed.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['keyword'],
      properties: {
        keyword: {
          type: 'string',
          description: 'Subject or course name to search, e.g. 管理学基础, 微观经济学, 考研政治.',
        },
        limit: {
          type: 'integer',
          description: `How many candidates to return (1-50). Defaults to ${defaultLimit}.`,
        },
        order: {
          type: 'string',
          enum: ['totalrank', 'click', 'pubdate', 'dm'],
          description: 'Ranking: totalrank = relevance (default), click = most played, pubdate = newest, dm = most danmaku.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['keyword', 'total', 'count', 'items'],
        properties: {
          keyword: { type: 'string' },
          total: { type: 'integer' },
          count: { type: 'integer' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['bvid', 'title', 'up', 'play', 'durationText', 'favorite', 'description', 'url'],
              properties: {
                bvid: { type: 'string' },
                title: { type: 'string' },
                up: { type: 'string' },
                play: { type: 'integer' },
                durationText: { type: 'string' },
                favorite: { type: 'integer' },
                description: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [text(
        `${value.count} of ${value.total} results for "${value.keyword}":\n`
        + value.items.map((it, i) => `${i + 1}. ${it.title} | ${it.up} | ${it.play} 播放 | ${it.durationText} | ${it.bvid}`).join('\n'),
      )],
    },
    async execute(args) {
      const result = await searchVideos(args.keyword, {
        limit: args.limit ?? defaultLimit,
        order: args.order,
      })
      return {
        keyword: result.keyword,
        total: result.total,
        count: result.items.length,
        items: result.items.map((it) => ({
          bvid: it.bvid,
          title: it.title,
          up: it.up,
          play: it.play,
          durationText: it.durationText,
          favorite: it.favorite,
          description: it.description,
          url: it.url,
        })),
      }
    },
    presentCall: (args) => ({ card: 'generic', title: `搜索：${args.keyword}`, kind: 'other', rawInput: args }),
  })

  ctx.tools.register({
    name: 'bili_course',
    description:
      'Read one bilibili video by bvid: title, uploader, total duration, play count, full page (分P) list, '
      + 'and a flag when the uploader looks like a paid-course funnel (e.g. "完整版加微信"). '
      + 'Use it to judge whether a candidate course is complete and free. Read-only.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['bvid'],
      properties: {
        bvid: {
          type: 'string',
          description: 'Video id such as BV1wZ421M76J (the BV part only).',
        },
        max_pages: {
          type: 'integer',
          description: 'Cap on returned pages (1-500). Defaults to 60; pageCount still reports the real total.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['bvid', 'title', 'up', 'totalText', 'pageCount', 'pagesShown', 'likelyFunnel', 'url', 'pages'],
        properties: {
          bvid: { type: 'string' },
          title: { type: 'string' },
          up: { type: 'string' },
          totalText: { type: 'string' },
          totalSeconds: { type: 'integer' },
          pageCount: { type: 'integer' },
          pagesShown: { type: 'integer' },
          play: { type: 'integer' },
          favorite: { type: 'integer' },
          publishDate: { type: 'string' },
          description: { type: 'string' },
          likelyFunnel: { type: 'boolean' },
          url: { type: 'string' },
          pages: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['index', 'title', 'durationSeconds', 'durationText'],
              properties: {
                index: { type: 'integer' },
                title: { type: 'string' },
                durationSeconds: { type: 'integer' },
                durationText: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [text(
        `${value.title}\nUP: ${value.up} | ${value.pageCount} 个分P | 总时长 ${value.totalText}`
        + `${value.likelyFunnel ? '\n⚠️ 疑似付费引流（标题/简介/分P名含"完整版/加微信"等）' : ''}`,
      )],
    },
    async execute(args) {
      const info = await fetchVideo(args.bvid, { maxPages: args.max_pages })
      return {
        bvid: info.bvid,
        title: info.title,
        up: info.up,
        totalText: info.totalText,
        totalSeconds: info.totalSeconds,
        pageCount: info.pageCount,
        pagesShown: info.pagesShown,
        play: info.play,
        favorite: info.favorite,
        publishDate: info.pubdate ? new Date(info.pubdate * 1000).toISOString().slice(0, 10) : '',
        description: info.description,
        likelyFunnel: info.likelyFunnel,
        url: info.url,
        pages: info.pages,
      }
    },
    presentCall: (args) => ({ card: 'generic', title: `读取：${args.bvid}`, kind: 'other', rawInput: args }),
  })

  ctx.tools.register({
    name: 'course_matrix_xlsx',
    description:
      'Write a styled .xlsx workbook to disk (no dependencies, no Excel required). Supports several sheets, '
      + 'column widths, frozen panes, auto-filter, and flat cell styles (header/bold/center/gray/plain/default). '
      + 'Use it to turn collected course data into a table the user can open directly.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['output', 'sheets'],
      properties: {
        output: {
          type: 'string',
          description: 'Destination .xlsx path. Relative paths resolve against the current working directory; parent folders are created.',
        },
        sheets: {
          type: 'array',
          description: 'One or more sheets in order.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'rows'],
            properties: {
              name: { type: 'string', description: 'Sheet name (max 31 chars).' },
              widths: {
                type: 'array',
                description: 'Column widths in characters, one per column.',
                items: { type: 'number' },
              },
              freeze: {
                type: 'object',
                additionalProperties: false,
                description: 'Frozen row/col counts from the top-left corner.',
                properties: {
                  row: { type: 'integer' },
                  col: { type: 'integer' },
                },
              },
              autoFilter: { type: 'boolean', description: 'Enable header-row filter dropdowns.' },
              rows: {
                type: 'array',
                description: 'Row-major cells. A cell is a string/number, or { value, style } to style it.',
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      value: { type: 'string' },
                      style: {
                        type: 'string',
                        enum: ['default', 'header', 'bold', 'center', 'gray', 'plain'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'bytes', 'sheets'],
        properties: {
          path: { type: 'string' },
          bytes: { type: 'integer' },
          sheets: { type: 'integer' },
        },
      },
      render: (_args, value) => [text(
        `已生成 ${value.sheets} 个工作表：${value.path}（${(value.bytes / 1024).toFixed(1)} KB）`,
      )],
    },
    async execute(args) {
      const sheets = Array.isArray(args.sheets) ? args.sheets : []
      if (!sheets.length) throw new Error('course_matrix_xlsx: `sheets` must contain at least one sheet')
      if (!String(args.output).toLowerCase().endsWith('.xlsx')) {
        throw new Error('course_matrix_xlsx: `output` must end with .xlsx')
      }
      const buffer = buildXlsx(sheets)
      const abs = resolveOut(args.output)
      fs.writeFileSync(abs, buffer)
      return { path: abs, bytes: buffer.length, sheets: sheets.length }
    },
    presentCall: (args) => ({ card: 'generic', title: '生成表格', kind: 'other', rawInput: { output: args.output } }),
  })

  // ---- Browser-facing JSON routes (web host only) -------------------------
  // The page cannot call api.bilibili.com directly: it answers 412 without a
  // buvid3 cookie and sends no CORS header. These routes proxy the same
  // public reads for the panel, and stay absent where no web server exists.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const json = (body, status = 200) => new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })

      const searchRoute = webCtx.webServer.register({
        kind: 'exact',
        path: '/api/course-matrix/search',
        resource: async (request) => {
          try {
            const url = new URL(request.url)
            const keyword = (url.searchParams.get('keyword') || '').trim()
            if (!keyword) return json({ error: '缺少 keyword 参数' }, 400)
            const platform = url.searchParams.get('platform') || 'bilibili'
            const levelId = url.searchParams.get('level') || 'zixue'
            const style = url.searchParams.get('style') || 'any'
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 12, 1), 30)
            const lv = getLevel(levelId)

            // 裸关键词会搜回一堆无关结果：先按学段拼一个限定词再搜，
            // 两个查询合并去重，相关性评分负责把跑偏的压到底部。
            const queries = []
            if (lv.suffixes.length) queries.push(keyword + ' ' + lv.suffixes[0])
            queries.push(keyword)

            const merged = new Map()
            let total = 0
            for (const q of queries) {
              try {
                const found = await searchVideos(q, { limit: 30, order: 'totalrank' })
                total = Math.max(total, found.total)
                for (const it of found.items) if (!merged.has(it.bvid)) merged.set(it.bvid, it)
              } catch (error) {
                if (merged.size === 0 && q === queries[queries.length - 1]) throw error
              }
            }

            const scored = Array.from(merged.values()).map((it) => {
              const verdict = scoreCourse(it, { level: lv.id, style, keyword })
              return {
                bvid: it.bvid,
                pageCount: verdict.pageCount || 0,
                auditReasons: verdict.auditReasons || [],
                suspicious: Boolean(verdict.suspicious),
                title: it.title,
                up: it.up,
                play: it.play,
                favorite: it.favorite,
                durationText: it.durationText,
                durationSeconds: it.durationSeconds,
                kind: verdict.kind,
                kindLabel: verdict.kind === 'system' ? '系统课' : verdict.kind === 'crash' ? '速通课' : '待确认',
                score: verdict.score,
                reason: verdict.reason,
                relevant: verdict.relevant,
                offLevel: verdict.offLevel,
                likelyFunnel: Boolean(it.likelyFunnel),
                suspicious: Boolean(verdict.suspicious),
                pageCount: verdict.pageCount || 0,
                auditReasons: verdict.auditReasons || [],
                url: it.url,
                description: it.description,
              }
            })

            // 全网资料：走宿主提供的网页搜索，用来找课件/PPT/文库这类非视频资源。
            let docs = []
            let docError = ''
            if (platform === 'web' || platform === 'all') {
              const web = typeof ctx.get === 'function' ? ctx.get('web') : undefined
              if (!web || typeof web.search !== 'function') {
                docError = '当前环境没有可用的网页搜索服务'
              } else {
                try {
                  const q = keyword + ' 课件 PPT 讲义 复习资料'
                  const controller = new AbortController()
                  const timer = setTimeout(() => controller.abort(), 25000)
                  let found = null
                  try {
                    found = await web.search({ query: q, maxResults: 10 }, controller.signal)
                  } finally {
                    clearTimeout(timer)
                  }
                  const sources = (found && (found.sources || found.results)) || []
                  docs = sources.map((src) => {
                    const href = String(src.url || src.link || '')
                    let host = ''
                    try { host = new URL(href).hostname.replace(/^www\./, '') } catch (e) { host = '' }
                    return {
                      title: String(src.title || src.name || href).slice(0, 120),
                      url: href,
                      host: host,
                      snippet: String(src.snippet || src.summary || src.description || '').slice(0, 180),
                    }
                  }).filter((d) => d.url)
                } catch (error) {
                  docError = '全网资料检索失败：' + String(error && error.message ? error.message : error)
                }
              }
            }

            if (platform === 'web') {
              return json({
                keyword, level: lv.id, levelLabel: lv.label, style,
                total, count: 0, items: [], docs, docError,
              })
            }

            scored.sort((a, b) => b.score - a.score)

            // 只看标题会被“挂羊头”骗：前几名打开分P实测一遍，
            // 分P标题重复、每集几分钟、塞满广告的，直接扣分。
            const auditTargets = scored.slice(0, 12)
            await Promise.all(auditTargets.map(async (item, i) => {
              await new Promise((r) => setTimeout(r, i * 120))
              try {
                const info = await fetchVideo(item.bvid, { maxPages: 80 })
                const a = auditCourse(info)
                item.pageCount = info.pageCount
                item.avgSeconds = a.avgSeconds
                item.suspicious = a.suspicious
                item.auditReasons = a.reasons
                item.score = Math.round((item.score - a.penalty) * 10) / 10
                if (a.suspicious && a.reasons.length) item.reason = '⚠️ ' + a.reasons[0]
              } catch (error) {
                item.auditReasons = ['分P读取失败，未审核']
              }
            }))
            scored.sort((a, b) => b.score - a.score)

            // 相关性太弱或学段明显不符的直接剔除；若剔除后太少就只放宽相关性。
            let items = scored.filter((x) => !x.offLevel && x.relevant >= 0.45 && !x.suspicious)
            if (items.length < 3) items = scored.filter((x) => x.relevant >= 0.45 && !x.suspicious)
            if (items.length < 3) items = scored.filter((x) => x.relevant >= 0.45)
            if (items.length < 3) items = scored
            if (style === 'system') items = items.filter((x) => x.kind !== 'crash')
            if (style === 'crash') items = items.filter((x) => x.kind !== 'system')
            const page = items.slice(0, limit)
            return json({ keyword, level: lv.id, levelLabel: lv.label, style, total, count: page.length, items: page, docs, docError })
          } catch (error) {
            return json({ error: String(error && error.message ? error.message : error) }, 502)
          }
        },
      })

      const courseRoute = webCtx.webServer.register({
        kind: 'exact',
        path: '/api/course-matrix/course',
        resource: async (request) => {
          try {
            const url = new URL(request.url)
            const bvid = (url.searchParams.get('bvid') || '').trim()
            if (!bvid) return json({ error: '缺少 bvid 参数' }, 400)
            const info = await fetchVideo(bvid, { maxPages: 12 })
            return json({
              bvid: info.bvid,
              title: info.title,
              up: info.up,
              totalText: info.totalText,
              pageCount: info.pageCount,
              play: info.play,
              favorite: info.favorite,
              likelyFunnel: info.likelyFunnel,
              kind: classifyCourse(info.title, info.totalSeconds),
              description: info.description,
              url: info.url,
              pages: info.pages.slice(0, 12).map((p) => ({ index: p.index, title: p.title, durationText: p.durationText })),
            })
          } catch (error) {
            return json({ error: String(error && error.message ? error.message : error) }, 502)
          }
        },
      })

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

      function readBody(req, limit = 400000) {
        return new Promise((resolve, reject) => {
          let size = 0
          const chunks = []
          req.on('data', (chunk) => {
            size += chunk.length
            if (size > limit) {
              reject(new Error('请求体过大（上限 400KB）'))
              req.destroy()
              return
            }
            chunks.push(chunk)
          })
          req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          req.on('error', reject)
        })
      }

      function sendJson(res, body, status = 200) {
        const payload = JSON.stringify(body)
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(payload),
        })
        res.end(payload)
      }

      // 考纲 → 按条目找课。只对每个章节标题搜一次，再取选中课程的分P做匹配。
      const syllabusRoute = webCtx.webServer.register({
        kind: 'exact',
        path: '/api/course-matrix/syllabus',
        handler: async (req, res) => {
          if (req.method !== 'POST') { sendJson(res, { error: '只接受 POST' }, 405); return }
          try {
            const body = JSON.parse(await readBody(req))
            const text = String(body.text || '')
            const level = body.level || 'zixue'
            const maxCourses = Math.min(Math.max(Number(body.maxCourses) || 6, 1), 10)
            const maxSections = Math.min(Math.max(Number(body.maxSections) || 12, 1), 20)

            const sections = parseSyllabus(text)
            if (!sections.length) { sendJson(res, { error: '没解析出考纲条目，检查一下文本格式' }, 400); return }

            const lv = getLevel(level)
            const subject = String(body.subject || '').trim()
            const allTitles = sections.map((x) => x.title)
            const picked = new Map()

            // 有科目名就用科目名搜：章节名（计划/组织/领导）太泛，
            // 搜出来全是无关课；科目名才能召回整门课的分P。
            if (subject) {
              const subQueries = []
              if (lv.suffixes.length) subQueries.push(subject + ' ' + lv.suffixes[0])
              subQueries.push(subject)
              const subCandidates = new Map()
              for (const q of subQueries) {
                try {
                  const found = await searchVideos(q, { limit: 15, order: 'totalrank' })
                  for (const it of found.items) if (!subCandidates.has(it.bvid)) subCandidates.set(it.bvid, it)
                } catch (error) {}
                await sleep(160)
              }
              for (const it of subCandidates.values()) {
                if (picked.size >= maxCourses) break
                if (it.likelyFunnel) continue
                if (Number(it.durationSeconds) < 1800) continue
                const verdict = scoreCourse(it, { level: lv.id, style: 'any', keyword: subject })
                if (verdict.relevant < 0.45) continue
                picked.set(it.bvid, {
                  title: it.title, up: it.up, play: it.play, durationText: it.durationText,
                  fromSections: allTitles.slice(),
                })
              }
            }

            for (const section of subject ? [] : sections.slice(0, maxSections)) {
              if (picked.size >= maxCourses) break
              // 每章搜两次：带学段限定词 + 裸章节名，候选池才够大。
              const queries = []
              if (lv.suffixes.length) queries.push(section.title + ' ' + lv.suffixes[0])
              queries.push(section.title)
              const candidates = new Map()
              for (const q of queries) {
                try {
                  const found = await searchVideos(q, { limit: 10, order: 'totalrank' })
                  for (const it of found.items) if (!candidates.has(it.bvid)) candidates.set(it.bvid, it)
                } catch (error) {}
                await sleep(160)
              }
              try {
                let taken = 0
                for (const it of candidates.values()) {
                  if (picked.size >= maxCourses || taken >= 2) break
                  if (it.likelyFunnel) continue
                  // 半小时以下的短片撑不起考纲对照，多半是切片或凑数结果。
                  if (Number(it.durationSeconds) < 1800) continue
                  const verdict = scoreCourse(it, { level: lv.id, style: 'any', keyword: section.title })
                  if (verdict.relevant < 0.45) continue
                  if (picked.has(it.bvid)) {
                    // 同一门课被多个章节搜到：记下它覆盖了哪些章。
                    picked.get(it.bvid).fromSections.push(section.title)
                    taken += 1
                    continue
                  }
                  picked.set(it.bvid, {
                    title: it.title, up: it.up, play: it.play, durationText: it.durationText,
                    fromSections: [section.title],
                  })
                  taken += 1
                }
              } catch (error) {
                // 单章搜不到不致命，继续下一章。
              }
            }

            const courses = []
            const failures = []
            for (const [bvid, meta] of picked) {
              try {
                const info = await fetchVideo(bvid, { maxPages: 200 })
                const audit = auditCourse(info)
                if (audit.suspicious) {
                  failures.push({ bvid, reason: '疑似引流/凑数：' + (audit.reasons[0] || '已剔除') })
                } else if (info.pageCount < 4) {
                  failures.push({ bvid, reason: '分P太少（' + info.pageCount + '），跳过' })
                } else {
                  courses.push({
                    bvid: bvid, title: info.title, up: info.up, pages: info.pages,
                    fromSections: meta.fromSections,
                  })
                }
              } catch (error) {
                failures.push({ bvid, reason: String(error && error.message ? error.message : error) })
              }
              await sleep(150)
            }

            const matrix = buildMatrix(sections, courses)
            const matchedRows = matrix.filter((r) => r.matches.length > 0).length
            sendJson(res, {
              level: lv.id,
              levelLabel: lv.label,
              sections: sections.length,
              items: matrix.length,
              matched: matchedRows,
              courses: courses.map((c) => ({ bvid: c.bvid, title: c.title, up: c.up, pages: c.pages.length, covers: (c.fromSections || []).length })),
              failures,
              matrix,
            })
          } catch (error) {
            sendJson(res, { error: String(error && error.message ? error.message : error) }, 502)
          }
        },
      })

      // 前端已经拿到 matrix，这里只负责把它变成 Excel 文件流。
      const syllabusXlsxRoute = webCtx.webServer.register({
        kind: 'exact',
        path: '/api/course-matrix/syllabus-xlsx',
        handler: async (req, res) => {
          if (req.method !== 'POST') { sendJson(res, { error: '只接受 POST' }, 405); return }
          try {
            const body = JSON.parse(await readBody(req))
            const matrix = Array.isArray(body.matrix) ? body.matrix : []
            if (!matrix.length) { sendJson(res, { error: '没有可导出的对照数据' }, 400); return }

            const header = ['序', '考纲章节', '考纲条目', '主/补', '对应课程', '分P', '起始时间', '分集标题', '命中词', '匹配分']
            const rows = [header.map((v) => ({ value: v, style: 'header' }))]
            let n = 0
            for (const row of matrix) {
              if (!row.matches || !row.matches.length) {
                n += 1
                rows.push([
                  String(n), row.section, row.item,
                  { value: '（未匹配到）', style: 'gray' }, '', '', '', '', '', '',
                ])
                continue
              }
              row.matches.forEach((m, i) => {
                n += 1
                rows.push([
                  i === 0 ? String(n) : '',
                  i === 0 ? row.section : '',
                  i === 0 ? row.item : '',
                  m.role === 'primary' ? '主课' : '补充',
                  m.course,
                  'P' + m.page,
                  m.at || '',
                  m.pageTitle,
                  (m.matched || []).join('、'),
                  String(m.score),
                ])
              })
            }

            const courseRows = [[
              { value: '课程', style: 'header' },
              { value: 'UP主', style: 'header' },
              { value: 'BV号', style: 'header' },
              { value: '链接', style: 'header' },
              { value: '分P数', style: 'header' },
            ]]
            for (const c of (body.courses || [])) {
              courseRows.push([c.title, c.up || '', c.bvid, 'https://www.bilibili.com/video/' + c.bvid + '/', String(c.pages || '')])
            }

            const buffer = buildXlsx([
              { name: '考纲对照', widths: [5, 18, 52, 7, 32, 6, 10, 44, 18, 8], freeze: { row: 1, col: 3 }, autoFilter: true, rows },
              { name: '课程清单', widths: [46, 18, 15, 44, 8], freeze: { row: 1 }, autoFilter: true, rows: courseRows },
            ])

            const name = '考纲对照表.xlsx'
            res.writeHead(200, {
              'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(name),
              'cache-control': 'no-store',
              'content-length': buffer.length,
            })
            res.end(buffer)
          } catch (error) {
            sendJson(res, { error: String(error && error.message ? error.message : error) }, 502)
          }
        },
      })

      return () => {
        searchRoute()
        courseRoute()
        syllabusRoute()
        syllabusXlsxRoute()
      }
    })
  })
}
