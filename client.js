window.__ModuleLoader__.load({
  id: '@local/course-matrix',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL_ID = 'course-matrix'

    const LEVELS = [
      ['primary', '小学', '同步课本、按年级章节走'],
      ['junior', '初中', '中考与教材同步'],
      ['senior', '高中', '高考与教材同步'],
      ['college', '大学期末', '专业课、期末不挂科'],
      ['zhuanshengben', '专升本', '按省考纲、合卷考'],
      ['kaoyan', '考研', '教材精讲、初试复试'],
      ['gongkao', '考公考编', '行测申论、事编省考'],
      ['zige', '职业资格', '教资、会计、法考等'],
      ['zixue', '兴趣自学', '不赶考，讲清楚就行'],
    ]
    const SOURCES = [
      ['bilibili', '只搜网课', 'B站公开视频，按分P核验'],
      ['all', '网课 + 资料', '再搜一遍全网课件/PPT/文库'],
      ['web', '只搜资料', '跳过视频，直接找课件和复习资料'],
    ]
    const STYLES = [
      ['any', '不限', '系统课和速通课都列出来'],
      ['system', '系统课', '分章节、长课时、成体系'],
      ['crash', '速通课', '几小时过完、考前救急'],
    ]
    const KIND_COLOR = {
      system: { background: 'rgba(47,158,68,0.18)' },
      crash: { background: 'rgba(232,89,12,0.18)' },
      unknown: { background: 'rgba(127,127,127,0.16)' },
    }

    const css = {
      page: {
        height: '100%', overflow: 'auto',
        paddingTop: 'var(--dsh-frame-top-clearance, 48px)',
        paddingBottom: 48,
        paddingLeft: 'clamp(20px, 5vw, 64px)',
        paddingRight: 'clamp(20px, 5vw, 64px)',
        color: 'inherit', fontSize: 14, lineHeight: 1.6,
      },
      inner: { maxWidth: 1000, margin: '0 auto' },
      title: { fontSize: 22, fontWeight: 600, margin: '0 0 6px' },
      sub: { margin: '0 0 18px', opacity: 0.62, fontSize: 13 },
      tabs: { display: 'flex', gap: 6, marginBottom: 16 },
      tab: {
        padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', borderRadius: 8,
        color: 'inherit', background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
      },
      tabOn: {
        padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', borderRadius: 8,
        color: '#fff', background: '#2F5597', border: '1px solid #2F5597',
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22))',
        borderRadius: 12, padding: '16px 18px', marginBottom: 14,
        background: 'var(--dsw-alias-bg-l1, rgba(127,127,127,0.05))',
      },
      cardTitle: { margin: '0 0 10px', fontSize: 13, fontWeight: 600, opacity: 0.85 },
      label: { fontSize: 12, fontWeight: 600, opacity: 0.72, marginBottom: 6, display: 'block' },
      row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
      field: { marginBottom: 14 },
      input: {
        width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
        borderRadius: 8, color: 'inherit',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
        background: 'var(--dsw-alias-bg-base, transparent)', outline: 'none',
      },
      textarea: {
        width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 13,
        lineHeight: 1.65, minHeight: 160, resize: 'vertical', borderRadius: 8,
        color: 'inherit', fontFamily: 'inherit',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
        background: 'var(--dsw-alias-bg-base, transparent)', outline: 'none',
      },
      chips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
      chip: {
        padding: '7px 13px', fontSize: 13, cursor: 'pointer', borderRadius: 999,
        color: 'inherit', background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
      },
      chipOn: {
        padding: '7px 13px', fontSize: 13, cursor: 'pointer', borderRadius: 999,
        color: '#fff', background: '#2F5597', border: '1px solid #2F5597',
      },
      chipHint: { fontSize: 11.5, opacity: 0.55, marginTop: 6 },
      btn: {
        padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
        borderRadius: 8, border: 'none', color: '#fff', background: '#2F5597',
      },
      btnGhost: {
        padding: '9px 18px', fontSize: 14, cursor: 'pointer', borderRadius: 8,
        color: 'inherit', background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
      },
      btnOff: { opacity: 0.45, cursor: 'not-allowed' },
      promptBox: {
        marginTop: 12, padding: '12px 14px', borderRadius: 8, fontSize: 12.5,
        whiteSpace: 'pre-wrap', lineHeight: 1.65, background: 'rgba(127,127,127,0.08)',
        border: '1px dashed var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
      },
      status: { marginTop: 10, fontSize: 12.5 },
      tableWrap: { overflowX: 'auto', marginTop: 4 },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
      th: {
        textAlign: 'left', padding: '8px 10px', fontWeight: 600, opacity: 0.8,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
      },
      td: {
        padding: '8px 10px', verticalAlign: 'top',
        borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.14))',
      },
      tag: {
        display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11.5,
        whiteSpace: 'nowrap',
      },
      link: { color: '#4c8dff', textDecoration: 'none' },
      hint: { fontSize: 12.5, opacity: 0.6 },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
    }

    /** localStorage 持久化的 state：切面板、刷新页面都不丢。 */
    function usePersisted(key, initial) {
      const [value, setValue] = React.useState(function () {
        try {
          const raw = window.localStorage.getItem('cm:' + key)
          return raw === null ? initial : JSON.parse(raw)
        } catch (e) { return initial }
      })
      React.useEffect(function () {
        try {
          const raw = JSON.stringify(value)
          if (raw && raw.length < 900000) window.localStorage.setItem('cm:' + key, raw)
        } catch (e) {}
      }, [value])
      return [value, setValue]
    }

    function Card(props) {
      return h('div', { style: css.card },
        props.title ? h('p', { style: css.cardTitle }, props.title) : null,
        props.children)
    }

    function Chips(props) {
      const current = props.options.filter(function (o) { return o[0] === props.value })[0]
      return h('div', null,
        h('div', { style: css.chips }, props.options.map(function (o) {
          const on = props.value === o[0]
          return h('button', {
            key: o[0], style: on ? css.chipOn : css.chip,
            onClick: function () { props.onChange(o[0]) }, title: o[2],
          }, o[1])
        })),
        h('div', { style: css.chipHint }, current ? current[2] : ''))
    }

    function Th(props) { return h('th', { style: css.th }, props.children) }
    function Td(props) { return h('td', { style: css.td }, props.children) }

    async function postJson(url, payload) {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let data = null
      try { data = await res.json() } catch (e) { data = null }
      if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status))
      if (!data) throw new Error('返回的不是 JSON')
      return data
    }

    /* ------------------------------------------------------------ 学科模式 -- */

    function SubjectMode(props) {
      const [keyword, setKeyword] = usePersisted('keyword', '')
      const [prompt, setPrompt] = usePersisted('prompt', '')
      const [copied, setCopied] = React.useState(false)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const [result, setResult] = usePersisted('result', null)
      const [detail, setDetail] = React.useState(null)
      const [detailLoading, setDetailLoading] = React.useState('')
      const [source, setSource] = usePersisted('source', 'bilibili')

      const trimmed = keyword.trim()
      const level = props.level
      const levelLabel = (LEVELS.filter(function (x) { return x[0] === level })[0] || LEVELS[8])[1]

      function buildPrompt() {
        if (!trimmed) return ''
        const styleText = props.style === 'system'
          ? '只要系统课（分章节、长课时、成体系），不要几小时速成剪辑。'
          : props.style === 'crash'
            ? '只要速通课（几小时过完、考前救急），不要上百集的长课。'
            : '系统课和速通课都要，请分开标注。'
        return [
          '我在学「' + trimmed + '」，用途是「' + levelLabel + '」。',
          '请只找和「' + levelLabel + '」这个阶段对得上的课：',
          '凡是考研、专升本、大学期末、中小学同步这些不属于该阶段的，一律排除，不要凑数。',
          styleText,
          '硬性要求：',
          '1. 只推荐能免费完整看完的，排除 3–5 集的试听切片；',
          '2. 排除标题或分P名里带「完整版加微信 / 私信引流 / 滴滴我」的付费钩子；',
          '3. 每门都要给：UP 主、分P数、总时长、播放量、BV 号；',
          '4. 按「完整免费 > 长且免费 > 官方账号 > 付费」排序，并标出哪些其实跑偏了。',
          '最后整理成表格，说明哪几门适合第一轮、哪几门适合冲刺。',
        ].join('\n')
      }

      async function search() {
        if (!trimmed || loading) return
        setLoading(true); setError(''); setDetail(null)
        try {
          const qs = new URLSearchParams({
            keyword: trimmed, level: level, style: props.style, limit: '12', platform: source,
          }).toString()
          const res = await fetch('/api/course-matrix/search?' + qs, { credentials: 'same-origin' })
          const data = await res.json()
          if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status))
          setResult(data)
        } catch (e) {
          setError('检索失败：' + (e && e.message ? e.message : String(e)))
          setResult(null)
        } finally { setLoading(false) }
      }

      async function inspect(bvid) {
        if (detailLoading) return
        setDetailLoading(bvid); setDetail(null)
        try {
          const res = await fetch('/api/course-matrix/course?bvid=' + encodeURIComponent(bvid), { credentials: 'same-origin' })
          const data = await res.json()
          if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status))
          setDetail(data)
        } catch (e) {
          setError('核验失败：' + (e && e.message ? e.message : String(e)))
        } finally { setDetailLoading('') }
      }

      const items = result && result.items ? result.items : []

      const promptBlock = prompt
        ? h(Card, { title: '优化后的提示词（可复制给任意 AI）' },
          h('div', { style: css.promptBox }, prompt),
          h('div', { style: Object.assign({}, css.row, { marginTop: 10 }) },
            h('button', {
              style: css.btnGhost,
              onClick: function () {
                if (!navigator.clipboard) return
                navigator.clipboard.writeText(prompt).then(function () {
                  setCopied(true)
                  setTimeout(function () { setCopied(false) }, 2200)
                }, function () {})
              },
            }, copied ? '已复制' : '复制')))
        : null

      const errorBlock = error
        ? h('div', { style: Object.assign({}, css.status, { color: '#e8590c' }) }, error)
        : null

      const detailBlock = detail
        ? h('div', { style: Object.assign({}, css.card, { marginTop: 12, marginBottom: 0 }) },
          h('div', { style: { fontWeight: 600, marginBottom: 6 } }, detail.title),
          h('div', null, 'UP：' + detail.up + ' ｜ 分P：' + detail.pageCount + ' ｜ 总时长：' + detail.totalText),
          h('div', { style: { marginTop: 6 } },
            detail.likelyFunnel
              ? h('span', { style: { color: '#e8590c' } }, '⚠️ 疑似付费引流，公开部分只是钩子')
              : h('span', { style: { color: '#2f9e44' } }, '✅ 未发现引流迹象')),
          detail.pages && detail.pages.length
            ? h('div', { style: { marginTop: 8, opacity: 0.8 } },
              '前几集：' + detail.pages.slice(0, 6).map(function (p) {
                return 'P' + p.index + ' ' + p.title
              }).join(' · '))
            : null)
        : null

      const resultRows = items.map(function (it, i) {
        return h('tr', { key: it.bvid },
          h(Td, null, String(i + 1)),
          h(Td, null, h('a', {
            href: it.url, target: '_blank', rel: 'noreferrer', style: css.link,
          }, it.title)),
          h(Td, null, it.up),
          h(Td, null, String(it.play)),
          h(Td, null, it.durationText),
          h(Td, null, it.pageCount ? String(it.pageCount) : '—'),
          h(Td, null, h('span', {
            style: Object.assign({}, css.tag, KIND_COLOR[it.kind] || {}),
          }, it.kindLabel)),
          h(Td, null, (it.suspicious || it.likelyFunnel)
            ? h('span', {
              style: Object.assign({}, css.tag, { background: 'rgba(232,89,12,0.22)' }),
              title: (it.auditReasons || []).join('；'),
            }, it.suspicious ? '⚠️ 可疑' : '⚠️ 引流')
            : h('span', { style: { opacity: 0.35 } }, '—')),
          h(Td, null, it.reason),
          h(Td, null, h('button', {
            style: css.btnGhost,
            disabled: detailLoading === it.bvid,
            onClick: function () { inspect(it.bvid) },
          }, detailLoading === it.bvid ? '读取中…' : '核验')))
      })

      const tableBlock = items.length === 0
        ? h('div', { style: css.hint }, '这一轮没筛到合适的。换个说法，或把课程偏好放宽到「不限」再试。')
        : h('div', { style: css.tableWrap },
          h('table', { style: css.table },
            h('thead', null,
              h('tr', null,
                h(Th, null, '#'), h(Th, null, '课程'), h(Th, null, 'UP主'),
                h(Th, null, '播放'), h(Th, null, '时长'), h(Th, null, '分P'), h(Th, null, '类型'),
                h(Th, null, '风险'), h(Th, null, '判断'), h(Th, null, ''))),
            h('tbody', null, resultRows)))

      const docs = (result && result.docs) ? result.docs : []
      const docRows = docs.map(function (d, i) {
        return h('tr', { key: d.url + i },
          h(Td, null, String(i + 1)),
          h(Td, null, h('a', { href: d.url, target: '_blank', rel: 'noreferrer', style: css.link }, d.title)),
          h(Td, null, d.host),
          h(Td, null, h('span', { style: { opacity: 0.7 } }, d.snippet)))
      })
      const docsBlock = docs.length
        ? h(Card, { title: '全网资料（' + docs.length + ' 条）' },
          h('div', { style: css.tableWrap },
            h('table', { style: css.table },
              h('thead', null, h('tr', null,
                h(Th, null, '#'), h(Th, null, '标题'), h(Th, null, '来源'), h(Th, null, '摘要'))),
              h('tbody', null, docRows))))
        : (result && result.docError
          ? h('div', { style: Object.assign({}, css.hint, { color: '#e8590c', marginTop: 8 }) }, result.docError)
          : null)

      const resultBlock = result
        ? h(Card, { title: levelLabel + ' 检索结果（' + result.count + ' 门）' }, tableBlock, detailBlock)
        : null

      return h('div', null,
        h(Card, { title: '说清需求' },
          h('div', { style: css.field },
            h('label', { style: css.label }, '课程 / 学科名'),
            h('input', {
              style: css.input,
              placeholder: '比如：微观经济学 / 考研政治 / 教师资格证·综合素质',
              value: keyword,
              onChange: function (e) { setKeyword(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') search() },
            })),
          h('div', { style: css.row },
            h('div', { style: { width: '100%' } },
              h('label', { style: css.label }, '搜索来源'),
              h(Chips, { options: SOURCES, value: source, onChange: setSource })),
            h('button', {
              style: trimmed ? css.btnGhost : Object.assign({}, css.btnGhost, css.btnOff),
              disabled: !trimmed,
              onClick: function () { setPrompt(buildPrompt()); setCopied(false) },
            }, '优化提示词'),
            h('button', {
              style: trimmed && !loading ? css.btn : Object.assign({}, css.btn, css.btnOff),
              disabled: !trimmed || loading,
              onClick: search,
            }, loading ? '检索中…' : '开始搜索'))),
        promptBlock,
        errorBlock,
        resultBlock,
        docsBlock)
    }

    /* ------------------------------------------------------------ 考纲模式 -- */

    const MG_TEXT = [
      '1 管理基础知识',
      '(1) 掌握管理的概念、性质与基本职能，掌握管理者的层次与类型，了解管理者的素质，掌握管理者的技能',
      '(2) 了解组织环境的概念、类型，熟悉组织环境的内容；掌握组织环境的分析方法，包括 PEST 分析法、SWOT 分析法、五力分析模型',
      '(3) 掌握古典管理理论中泰罗的科学管理理论和法约尔的一般管理理论的主要内容，了解人际关系学说和学习型组织理论的主要内容',
      '2 计划',
      '(1) 了解决策的含义、类型及其在管理中的应用，理解决策的原则和过程，掌握决策的方法',
      '(2) 了解计划的概念、内容、类型、编制程序',
      '(3) 掌握目标管理的概念、特点、程序',
      '3 组织',
      '(1) 掌握组织设计的内容与总原则',
      '(2) 掌握组织部门化的方法，了解管理幅度、管理层次的概念及影响因素，影响集权与分权的主要因素，了解职权的概念、形式及运行方式',
      '(3) 掌握组织结构的基本类型及各自的优缺点、适用范围，了解新型组织结构',
      '(4) 了解组织变革的动因和内容',
      '(5) 了解组织文化的内涵、特征、结构及功能',
      '4 领导',
      '(1) 理解领导的内涵，熟悉四种人性假设的内容；掌握领导特质理论；掌握领导作风理论、领导四分图理论和管理方格理论等领导行为理论；掌握费德勒权变理论、领导情境理论和路径—目标理论等领导权变理论',
      '(2) 理解激励的内涵，掌握内容激励理论、过程激励理论及行为改造理论的主要内容、特点，掌握激励的方法',
      '(3) 了解沟通的概念和过程，理解正式沟通和非正式沟通的类型与特点，熟悉阻碍有效沟通的因素和提高沟通效果的方法',
      '5 控制',
      '(1) 了解控制的含义、不同分类标准下的控制类型、控制工作的步骤',
      '(2) 掌握管理控制的一般过程和要求',
      '(3) 掌握有效控制的方法',
      '6 管理创新',
      '(1) 理解管理创新的概念、类型及特征',
      '(2) 了解管理创新的内容、方法与过程',
      '(3) 了解中国企业管理创新的趋势',
    ].join('\n')

    const BIO_TEXT = [
      '必修一 分子与细胞',
      '1 细胞的分子组成',
      '(1) 蛋白质、核酸的结构和功能',
      '(2) 糖类、脂质的种类和作用',
      '(3) 水和无机盐的作用',
      '2 细胞的结构',
      '(1) 细胞学说的建立过程',
      '(2) 细胞膜的结构与功能',
      '(3) 主要细胞器的结构与功能',
      '(4) 细胞核的结构与功能',
      '3 细胞的代谢',
      '(1) 酶在代谢中的作用，ATP 在能量代谢中的作用',
      '(2) 光合作用的基本过程及影响光合作用速率的环境因素',
      '(3) 细胞呼吸及其原理的应用',
      '4 细胞的增殖与分化',
      '(1) 细胞的生长和增殖的周期性',
      '(2) 细胞的有丝分裂及其意义',
      '(3) 细胞的分化、衰老和凋亡与人体健康的关系',
      '必修二 遗传与进化',
      '5 遗传的基本规律',
      '(1) 孟德尔遗传实验的科学方法',
      '(2) 基因的分离定律和自由组合定律',
      '(3) 基因与性状的关系',
      '6 遗传的细胞基础与分子基础',
      '(1) 减数分裂和受精作用',
      '(2) DNA 分子的结构、复制和基因的概念',
      '(3) 遗传信息的转录和翻译',
      '7 生物的变异与进化',
      '(1) 基因突变、基因重组和染色体变异',
      '(2) 现代生物进化理论的主要内容',
      '必修三 稳态与环境',
      '8 人体的内环境与稳态',
      '(1) 稳态的生理意义',
      '(2) 神经调节、体液调节及其相互关系',
      '(3) 免疫调节在维持稳态中的作用',
      '9 植物激素与种群群落',
      '(1) 植物激素的调节作用',
      '(2) 种群的特征和数量变化',
      '(3) 群落的结构特征与演替',
      '10 生态系统与环境保护',
      '(1) 生态系统的结构、能量流动和物质循环',
      '(2) 生态系统中的信息传递与稳定性',
      '(3) 人口增长对生态环境的影响与生物多样性保护',
    ].join('\n')

    const SAMPLES = [
      { label: '广西专升本 · 管理学基础', text: MG_TEXT, level: 'zhuanshengben', subject: '管理学基础 专升本' },
      { label: '高考生物 · 必修一~三', text: BIO_TEXT, level: 'senior', subject: '高中生物' },
    ]

    function SyllabusMode(props) {
      const [text, setText] = usePersisted('syllabusText', '')
      const [subject, setSubject] = usePersisted('syllabusSubject', '')
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const [data, setData] = usePersisted('syllabusData', null)
      const [exporting, setExporting] = React.useState(false)

      const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() }).length
      const levelLabel = (LEVELS.filter(function (x) { return x[0] === props.level })[0] || LEVELS[8])[1]

      async function build() {
        if (!text.trim() || loading) return
        setLoading(true); setError(''); setData(null)
        try {
          const res = await postJson('/api/course-matrix/syllabus', {
            text: text, level: props.level, maxCourses: 6, subject: subject.trim(),
          })
          setData(res)
        } catch (e) {
          setError('整理失败：' + (e && e.message ? e.message : String(e)))
        } finally { setLoading(false) }
      }

      async function download() {
        if (!data || exporting) return
        setExporting(true)
        try {
          const res = await fetch('/api/course-matrix/syllabus-xlsx', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ matrix: data.matrix, courses: data.courses }),
          })
          if (!res.ok) {
            let msg = 'HTTP ' + res.status
            try { const j = await res.json(); if (j && j.error) msg = j.error } catch (e) {}
            throw new Error(msg)
          }
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = '考纲对照表.xlsx'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(function () { URL.revokeObjectURL(url) }, 1500)
        } catch (e) {
          setError('导出失败：' + (e && e.message ? e.message : String(e)))
        } finally { setExporting(false) }
      }

      const matrix = data && data.matrix ? data.matrix : []

      const errorBlock = error
        ? h('div', { style: Object.assign({}, css.status, { color: '#e8590c' }) }, error)
        : null

      const rows = matrix.map(function (row, i) {
        const cell = (row.matches && row.matches.length)
          ? row.matches.map(function (m, j) {
            return h('div', { key: j, style: { marginBottom: 5, lineHeight: 1.5 } },
              h('span', {
                style: Object.assign({}, css.tag, {
                  marginRight: 6,
                  background: m.role === 'primary' ? 'rgba(47,85,151,0.18)' : 'rgba(127,127,127,0.16)',
                }),
              }, m.role === 'primary' ? '主' : '补'),
              h('a', {
                href: 'https://www.bilibili.com/video/' + m.bvid + '/',
                target: '_blank', rel: 'noreferrer', style: css.link,
              }, 'P' + m.page),
              h('span', { style: { opacity: 0.55, marginLeft: 4 } }, m.at || ''),
              h('span', { style: { marginLeft: 8 } }, m.pageTitle),
              h('div', { style: { opacity: 0.42, fontSize: 11.5, marginTop: 1 } },
                m.course.slice(0, 26) + ' · ' + (m.coursePages || '?') + 'P · 分' + m.score))
          })
          : h('span', { style: { opacity: 0.4 } }, '（未匹配）')
        return h('tr', { key: i },
          h(Td, null, row.section),
          h(Td, null, row.item),
          h(Td, null, cell),
          h(Td, null, row.matches && row.matches[0] ? (row.matches[0].matched || []).join('、') : ''))
      })

      const resultBlock = data
        ? h(Card, null,
          h('div', { style: Object.assign({}, css.row, { justifyContent: 'space-between', marginBottom: 10 }) },
            h('div', { style: { fontSize: 13 } },
              levelLabel + '｜' + data.sections + ' 个章节 / ' + data.items + ' 条考纲，匹配上 '
              + data.matched + ' 条，用了 ' + data.courses.length + ' 门课（含补充课）'
              + (subject.trim() ? '' : ' · 未填科目名，召回偏窄')),
            h('button', { style: css.btn, disabled: exporting, onClick: download },
              exporting ? '导出中…' : '下载 Excel')),
          h('div', { style: Object.assign({}, css.hint, { marginBottom: 10 }) },
            '匹配是按关键词做的，不保证语义全对——先看表，不对的条目自己调。'),
          h('div', { style: css.tableWrap },
            h('table', { style: css.table },
              h('thead', null,
                h('tr', null,
                  h(Th, null, '章节'), h(Th, null, '考纲条目'),
                  h(Th, null, '参考位置（主课/补充 · 分P · 起始时间）'), h(Th, null, '命中词'))),
              h('tbody', null, rows))),
          (data.failures && data.failures.length)
            ? h('div', { style: Object.assign({}, css.hint, { marginTop: 10, color: '#e8590c' }) },
              '有 ' + data.failures.length + ' 门课没读到分P（可能被限流），可以重试一次。')
            : null)
        : null

      return h('div', null,
        h(Card, { title: '粘贴考纲 / 复习大纲' },
          h('div', { style: css.field },
            h('label', { style: css.label }, '科目 / 课程名（强烈建议填，决定去哪搜课）'),
            h('input', {
              style: css.input,
              placeholder: '比如：管理学基础 / 电子商务基础 / 高中生物必修一',
              value: subject,
              onChange: function (e) { setSubject(e.target.value) },
            }),
            h('div', { style: Object.assign({}, css.hint, { marginTop: 6 }) },
              '不填就只能拿「计划」「组织」这种章节名去搜，召回的多半是无关课。')),
          h('div', { style: css.field },
            h('label', { style: css.label }, '考纲文本（章节 + 条目，一行一条）'),
            h('textarea', {
              style: css.textarea,
              placeholder: '1 管理基础知识\n(1) 掌握管理的概念、性质与基本职能\n(2) 了解组织环境的概念、类型，掌握 PEST、SWOT 分析法',
              value: text,
              onChange: function (e) { setText(e.target.value) },
            }),
            h('div', { style: Object.assign({}, css.hint, { marginTop: 6 }) },
              '已识别 ' + lines + ' 行。支持「1 / （1）/ 第一章 / 一、」这类编号，没有编号的短句也会被当作条目。')),
          h('div', { style: css.row },
            h('button', {
              style: text.trim() && !loading ? css.btn : Object.assign({}, css.btn, css.btnOff),
              disabled: !text.trim() || loading,
              onClick: build,
            }, loading ? '正在拆解并找课…' : '解析考纲并找课'),
            SAMPLES.map(function (sample) {
              return h('button', {
                key: sample.label,
                style: css.btnGhost,
                onClick: function () {
                  setText(sample.text)
                  setSubject(sample.subject || '')
                  props.onLevel(sample.level)
                },
              }, '示例：' + sample.label)
            }))),
        errorBlock,
        resultBlock)
    }

    /* ------------------------------------------------------------------ 壳 -- */

    function Panel() {
      const [mode, setMode] = usePersisted('mode', 'subject')
      const [level, setLevel] = usePersisted('level', 'zixue')
      const [style, setStyle] = usePersisted('style', 'any')

      return h('div', { style: css.page },
        h('div', { style: css.inner },
          h('h1', { style: css.title }, '网课整理器'),
          h('p', { style: css.sub }, '按学科搜，或者把考纲丢进来，逐条配课。'),

          h('div', { style: css.tabs },
            h('button', {
              style: mode === 'subject' ? css.tabOn : css.tab,
              onClick: function () { setMode('subject') },
            }, '按学科搜'),
            h('button', {
              style: mode === 'syllabus' ? css.tabOn : css.tab,
              onClick: function () { setMode('syllabus') },
            }, '按考纲整理')),

          h(Card, { title: '学段 / 用途' },
            h(Chips, { options: LEVELS, value: level, onChange: setLevel }),
            mode === 'subject'
              ? h('div', { style: { marginTop: 14 } },
                h('label', { style: css.label }, '课程偏好'),
                h(Chips, { options: STYLES, value: style, onChange: setStyle }))
              : h('div', { style: Object.assign({}, css.hint, { marginTop: 10 }) },
                '考纲模式下会按每个章节标题搜索，再挑最相关的几门课拆分P。')),

          mode === 'subject'
            ? h(SubjectMode, { level: level, style: style })
            : h(SyllabusMode, { level: level, onLevel: setLevel }),

          h(Card, null,
            h('div', { style: css.hint },
              '只读公开数据，不登录、不下载视频、不购买课程。考纲对照是按关键词匹配的，用来省手工检索，不替代你自己的判断。'))))
    }

    function Icon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true,
        style: { display: 'block' },
      },
      h('rect', {
        x: 2.5, y: 4.5, width: 19, height: 15, rx: 3,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
      }),
      h('path', { d: 'M2.5 9h19', stroke: 'currentColor', strokeWidth: 1.7 }),
      h('path', {
        d: 'M6 13.2h5M6 16.2h3.5M14 13.2h4M14 16.2h4',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
      }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', function () {
          return ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel)
        })
        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: '网课整理器',
          }, Icon)
        })
      },
    }
  },
})
