import { describe, expect, it } from 'vitest'
import {
  buildBangbooSkills,
  buildCoreSkill,
  buildSkillMetricTable,
  buildSkillRows,
  isPotentialGated,
  potentialStartLevel,
  synthesizePotentialCinema,
  bangbooSkillStatValue,
  type SkillGroup
} from '../src/domain/sections'

describe('skill helpers', () => {
  it('buildSkillRows filters missing slots and keeps order', () => {
    const rows = buildSkillRows({
      special: { description: [{ name: 'X' }] },
      basic: { description: [{ name: 'Y' }] },
    })
    expect(rows.map((r) => r.key)).toEqual(['basic', 'special'])
  })

  it('buildSkillRows returns [] for empty input', () => {
    expect(buildSkillRows(undefined)).toEqual([])
    expect(buildSkillRows({})).toEqual([])
  })

  it('buildSkillRows merges simple descriptions into groups, skipping empty-param blocks', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：狡兔连打', desc: '点按发动攻击。', potential: [] },
          { name: '普通攻击：为所欲为', desc: '上弹强化普攻。', potential: [] },
          { name: '普通攻击：狡兔连打', desc: '{Skill:1031001, Prop:1001}', param: [] },
          { name: '普通攻击：为所欲为', desc: '{Skill:1031002, Prop:1001}', param: [] },
        ],
      },
    })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.hasNumbers).toBe(false)
    expect(row.groups).toEqual([
      { name: '普通攻击：狡兔连打', desc: '点按发动攻击。' },
      { name: '普通攻击：为所欲为', desc: '上弹强化普攻。' },
    ])
  })

  it('buildSkillRows returns no groups when only empty-param blocks exist', () => {
    const rows = buildSkillRows({
      special: { description: [{ name: '特殊技：X', desc: '{Skill:1}', param: [] }] },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].groups).toBeUndefined()
    expect(rows[0].hasNumbers).toBe(false)
  })

  it('buildSkillRows 把 chain 槽内的终结技拆分为独立「终结技」行（与连携技分列）', () => {
    const rows = buildSkillRows({
      chain: {
        description: [
          { name: '连携技：行军仪仗', desc: '配合协攻。', potential: [] },
          { name: '终结技：万军诛绝', desc: '上分支终结技。', potential: [] },
          { name: '终结技：凯旋坦途', desc: '下分支终结技。', potential: [] },
          {
            name: '连携技：行军仪仗',
            param: [
              {
                name: '伤害倍率',
                desc: '{Skill:1551012, Prop:1001}',
                param: { '1551012': { main: 105830, growth: 9630, format: '%' } },
              },
            ],
            potential: [],
          },
        ],
      },
    })
    expect(rows.map((r) => r.key)).toEqual(['chain', 'ultimate'])
    expect(rows[0].zh).toBe('连携技')
    expect(rows[0].groups?.map((g) => g.name)).toEqual(['连携技：行军仪仗'])
    expect(rows[0].hasNumbers).toBe(true)
    expect(rows[1].zh).toBe('终结技')
    expect(rows[1].groups?.map((g) => g.name)).toEqual(['终结技：万军诛绝', '终结技：凯旋坦途'])
  })

  it('buildSkillRows 的 chain 槽无终结技时仍只输出一行连携技', () => {
    const rows = buildSkillRows({
      chain: { description: [{ name: '连携技：行军仪仗', desc: '说明。', potential: [] }] },
    })
    expect(rows.map((r) => r.key)).toEqual(['chain'])
    expect(rows[0].zh).toBe('连携技')
  })

  it('buildSkillRows 把描述中引用「[终结技：…]」的派生招式并入终结技行', () => {
    const rows = buildSkillRows({
      chain: {
        description: [
          { name: '连携技：会·御', desc: '连携攻击。', potential: [] },
          { name: '终结技：残心', desc: '终极一击。', potential: [] },
          { name: '残心·散华', desc: '[终结技：残心]发动后自动派生：大范围穿透攻击。', potential: [] },
        ],
      },
    })
    const chain = rows.find((r) => r.key === 'chain')
    const ultimate = rows.find((r) => r.key === 'ultimate')
    expect(chain?.groups?.map((g) => g.name)).toEqual(['连携技：会·御'])
    expect(ultimate?.groups?.map((g) => g.name)).toEqual(['终结技：残心', '残心·散华'])
  })
})

describe('potential-gated skills（潜能影像门控招式）', () => {
  it('isPotentialGated 区分真实档位 id 与基础标记 [0]', () => {
    expect(isPotentialGated([])).toBe(false)
    expect(isPotentialGated([0])).toBe(false)
    expect(isPotentialGated([119100, 119101])).toBe(true)
    expect(isPotentialGated(undefined)).toBe(false)
  })

  it('potentialStartLevel 映射档位 I-VI（取最早档）', () => {
    expect(potentialStartLevel([0])).toBeUndefined()
    expect(potentialStartLevel([])).toBeUndefined()
    expect(potentialStartLevel([119100, 119101, 119105])).toBe('I')
    expect(potentialStartLevel([119102])).toBe('III')
  })

  it('buildSkillRows 将门控招式标记为新增，并保留同名强化版原文', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：利齿修剪法', desc: '基础招式。', potential: [] },
          { name: '普通攻击：冰刃浪', desc: '新招式一。', potential: [119100, 119101] },
          { name: '普通攻击：霜锋', desc: '新招式二。', potential: [119100] },
        ],
      },
      dodge: {
        description: [
          { name: '冲刺攻击：潜袭', desc: '基础潜袭。', potential: [0] },
          { name: '冲刺攻击：潜袭', desc: '强化可免疫伤害。', potential: [119100] },
        ],
      },
    })
    const basicGroup = rows.find((r) => r.key === 'basic')
    const newG = basicGroup?.groups?.find((g) => g.name === '普通攻击：冰刃浪')
    expect(newG?.potentialType).toBe('new')
    expect(potentialStartLevel(newG?.potential)).toBe('I')
    // 同名强化版：门控分支被判定为强化，且原文与基础版并列保留
    const dodgeGroup = rows.find((r) => r.key === 'dodge')
    const dash = dodgeGroup?.groups?.find((g) => g.name === '冲刺攻击：潜袭')
    expect(dash?.potentialType).toBe('enhance')
    expect(dash?.desc).toBe('基础潜袭。')
    expect(dash?.strongDesc).toBe('强化可免疫伤害。')
  })

  it('带 potential 的纯数值子块独立成组，吸附在父招式之后而非并入其参数列表', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '强化特殊技：超规工程清障', desc: '投掷手雷，额外投掷一枚[涡流集束手雷]。', potential: [0] },
          { name: '强化特殊技：超规工程清障', desc: '投掷手雷，额外投掷一枚[涡流集束手雷]，牵引敌人。', potential: [119100] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [119100],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 子块按机制名「涡流集束手雷」独立成组，吸附到「强化特殊技：超规工程清障」之后
    expect(gs.map((g) => g.name)).toEqual(['强化特殊技：超规工程清障', '涡流集束手雷基础倍率'])
    // 父组参数列表不并入子块数值，条目名不加子块前缀
    expect(gs[0].entries).toBeUndefined()
    expect(gs[1].entries?.map((e) => e.name)).toEqual(['伤害倍率'])
    // 子块自成门控组（无同名基础版 → 判定为潜能新增），标记为派生技能（不悬挂潜能徽标）
    expect(gs[1].potentialType).toBe('new')
    expect(gs[1].derived).toBe(true)
  })

  it('派生技能子组吸附时紧跟父招式（父组非末位时同样上移至其下）', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '特殊技：工程清障', desc: '基础招式。', potential: [0] },
          { name: '强化特殊技：超规工程清障', desc: '投掷额外[涡流集束手雷]。', potential: [119100] },
          { name: '特殊技：工程清障·循环', desc: '循环投掷。', potential: [119100] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [119100],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    expect(gs.map((g) => g.name)).toEqual([
      '特殊技：工程清障',
      '强化特殊技：超规工程清障',
      '涡流集束手雷基础倍率',
      '特殊技：工程清障·循环',
    ])
  })

  it('无法唯一命中父招式时，派生技能子块不吸附，保持原位独立成行（仍挂标签）', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '特殊技：工程清障', desc: '基础描述，不含该机制名。', potential: [] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [119100],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 机制名「涡流集束手雷」在现有招式中无命中 → 不吸附，但派生技能标记照常（标签与吸附无关）
    expect(gs.map((g) => g.name)).toEqual(['特殊技：工程清障', '涡流集束手雷基础倍率'])
    expect(gs[1].entries?.map((e) => e.name)).toEqual(['伤害倍率'])
    expect(gs[1].derived).toBe(true)
  })

  it('无潜能门控的纯数值子块同样标记为派生技能（无论是否由潜能影像提供）', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '特殊技：工程清障', desc: '基础描述，不含该机制名。', potential: [] },
          {
            name: '微域气旋',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    expect(gs[1].derived).toBe(true)
    expect(gs[1].potentialType).toBeUndefined()
  })

  it('非潜能纯数值子块吸附到机制名命中的父招式之下（吸附不限潜能）', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：落华·崩坠', desc: '「席德」消耗60点[钢能]可释放[普通攻击：落华·崩坠一式]，并衔接发动[普通攻击：落华·崩坠二式]。', potential: [] },
          { name: '普通攻击：落华·重戮', desc: '第四段重击。', potential: [] },
          {
            name: '普通攻击：落华·崩坠一式',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
          {
            name: '普通攻击：落华·崩坠二式',
            param: [{ name: '伤害倍率', desc: '{Skill:3, Prop:1001}', param: { '3': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    expect(gs.map((g) => g.name)).toEqual([
      '普通攻击：落华·崩坠',
      '普通攻击：落华·崩坠一式',
      '普通攻击：落华·崩坠二式',
      '普通攻击：落华·重戮',
    ])
    expect(gs[1].derived).toBe(true)
    expect(gs[2].derived).toBe(true)
  })

  it('机制名同时命中多个父招式（歧义）时不吸附，保持原位独立成行', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '招式甲', desc: '投掷一枚[涡流集束手雷]。', potential: [] },
          { name: '招式乙', desc: '也投掷一枚[涡流集束手雷]。', potential: [] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 两处命中 → 歧义，吸附护栏生效：不吸附，维持数据原序
    expect(gs.map((g) => g.name)).toEqual(['招式甲', '招式乙', '涡流集束手雷基础倍率'])
    expect(gs[2].derived).toBe(true)
  })

  it('退化匹配：尾 token 命中父招式（机制名长前缀被截断，如「…山君鼎戏·威势」）', () => {
    const rows = buildSkillRows({
      dodge: {
        description: [
          {
            name: '冲刺攻击：恶虎七式·山君鼎戏',
            desc: '进入高速旋转状态接触敌人造成物理伤害；获得[威势]后带火焰，消耗1点[威势]改为火属性伤害。',
            potential: [],
          },
          {
            name: '冲刺攻击：恶虎七式·山君鼎戏·威势',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 完整名无命中 → 退化到尾 token「威势」，唯一命中旋转招式，吸附其下
    expect(gs.map((g) => g.name)).toEqual(['冲刺攻击：恶虎七式·山君鼎戏', '冲刺攻击：恶虎七式·山君鼎戏·威势'])
    expect(gs[1].derived).toBe(true)
  })

  it('退化匹配：去全角引号后命中父招式（「…·「虎威」」）', () => {
    const rows = buildSkillRows({
      dodge: {
        description: [
          {
            name: '冲刺攻击：恶虎七式·山君鼎戏',
            desc: '松开可退出旋转状态，并丢出「虎威」攻击敌人，造成火属性伤害。',
            potential: [],
          },
          {
            name: '冲刺攻击：恶虎七式·山君鼎戏·「虎威」',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 完整名含全角引号无法逐字命中；归一化去引号后尾 token「虎威」唯一命中
    expect(gs.map((g) => g.name)).toEqual(['冲刺攻击：恶虎七式·山君鼎戏', '冲刺攻击：恶虎七式·山君鼎戏·「虎威」'])
    expect(gs[1].derived).toBe(true)
  })

  it('退化匹配：段次后缀剔除后命中父招式（「普通攻击：敛枪式 第一段」）', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：凛冽枪尖', desc: '向前方发动至多四段斩击。', potential: [] },
          {
            name: '普通攻击：敛枪式',
            desc: '按当前分支段数发动[普通攻击：敛枪式]，共有三段；[普通攻击：敛枪式]第一、二段蓄力期间可格挡。',
            potential: [],
          },
          {
            name: '普通攻击：敛枪式 第一段',
            param: [{ name: '伤害倍率', desc: '{Skill:7, Prop:1001}', param: { '7': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 段次「第一段」与招式名被「、二」间隔无法连续命中；剔除段次后缀后以「敛枪式」唯一命中
    expect(gs.map((g) => g.name)).toEqual(['普通攻击：凛冽枪尖', '普通攻击：敛枪式', '普通攻击：敛枪式 第一段'])
    expect(gs[2].derived).toBe(true)
  })

  it('Skill ID 共享兜底：无文本信号但复用父级数值节点（「为所欲为」）', () => {
    const rows = buildSkillRows({
      dodge: {
        description: [
          { name: '冲刺攻击：惊喜开箱', desc: '向对应方向冲刺并打击，招式发动后自动上弹强化[冲刺攻击]。', potential: [] },
          {
            name: '冲刺攻击：惊喜开箱',
            param: [{ name: '前闪攻击伤害倍率', desc: '{Skill:201, Prop:1001}', param: { '201': { main: 3000, growth: 100, format: '%' } } }],
            potential: [],
          },
          {
            name: '冲刺攻击：为所欲为',
            param: [
              {
                name: '前闪攻击伤害倍率',
                desc: '{Skill:201, Prop:1001} + {{Skill:203, Prop:1001}/13}*13',
                param: {
                  '201': { main: 3000, growth: 100, format: '%' },
                  '203': { main: 1000, growth: 100, format: '%' },
                },
              },
            ],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 槽内无任何文本提及「为所欲为」；其公式复用「惊喜开箱」的前闪攻击 Skill 节点 → 唯一共享即吸附
    expect(gs.map((g) => g.name)).toEqual(['冲刺攻击：惊喜开箱', '冲刺攻击：为所欲为'])
    expect(gs[1].derived).toBe(true)
  })

  it('退化候选命中多组（歧义）时终止，不因更短尾词唯一而强行吸附', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：敛枪式', desc: '[普通攻击：敛枪式]共有三段，第一、二段可格挡。', potential: [] },
          { name: '普通攻击：敛枪式·硬直', desc: '硬直状态下衔接[第一段]的[普通攻击：敛枪式]派生。', potential: [] },
          {
            name: '普通攻击：敛枪式 第一段',
            param: [{ name: '伤害倍率', desc: '{Skill:7, Prop:1001}', param: { '7': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 段次退化候选「普通攻击敛枪式」命中 2 组（本尊 + 硬直派生）→ 歧义即终止；
    // 尾词「第一段」虽能唯一命中「硬直」，但跨族候选无单调性，不以碰巧的短词强行归并
    expect(gs.map((g) => g.name)).toEqual(['普通攻击：敛枪式', '普通攻击：敛枪式·硬直', '普通攻击：敛枪式 第一段'])
    expect(gs[2].derived).toBe(true)
  })

  it('Skill ID 共享兜底遇多个共享组时歧义不吸附', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '招式甲', desc: '描述甲。', potential: [] },
          {
            name: '招式甲',
            param: [{ name: '伤害倍率', desc: '{Skill:9, Prop:1001}', param: { '9': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
          { name: '招式乙', desc: '描述乙。', potential: [] },
          {
            name: '招式乙',
            param: [{ name: '伤害倍率', desc: '{Skill:9, Prop:1001}', param: { '9': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
          {
            name: '无信号派生块',
            param: [{ name: '伤害倍率', desc: '{Skill:9, Prop:1001}', param: { '9': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 文本全 0 命中 → 共享兜底：招式甲/乙均引用同一 Skill → 共享 2 组 → 歧义不吸附
    expect(gs.map((g) => g.name)).toEqual(['招式甲', '招式乙', '无信号派生块'])
    expect(gs[2].derived).toBe(true)
  })

  it('纯标点命名的派生块不因空归一化误吸附', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '特殊技：测试', desc: '任意说明。', potential: [] },
          {
            name: '“”',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [],
          },
        ],
      },
    })
    const gs = rows[0]?.groups ?? []
    // 归一化后为空串不得触发 includes('') 恒真误吸附；退化候选与 Skill 共享均无信号 → 原位独立
    expect(gs.map((g) => g.name)).toEqual(['特殊技：测试', '“”'])
    expect(gs[1].derived).toBe(true)
  })

  it('同名「基础+强化」两形态分别存入 desc 与 strongDesc，供前端切换', () => {
    const rows = buildSkillRows({
      dodge: {
        description: [
          { name: '冲刺攻击：冰渊潜袭', desc: '点按快速剪击。蓄力剪击命中获充能；蓄力期间减伤40%。', potential: [0] },
          { name: '冲刺攻击：冰渊潜袭', desc: '点按快速剪击。蓄力剪击命中获充能；蓄力期间减伤40%。受击时可免疫伤害并立即蓄力。', potential: [119100] },
        ],
      },
    })
    const dash = rows[0]?.groups?.find((g) => g.name === '冲刺攻击：冰渊潜袭')
    expect(dash?.potentialType).toBe('enhance')
    expect(dash?.desc).toContain('减伤40%。')
    expect(dash?.strongDesc).toContain('免疫伤害并立即蓄力')
  })

  it('synthesizePotentialCinema 为 description 为空的档位（档 I）生成概述', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：冰刃浪', desc: '新招式。', potential: [119100] },
          { name: '普通攻击：霜锋', desc: '新招式。', potential: [119100] },
        ],
      },
      dodge: {
        description: [
          { name: '冲刺攻击：潜袭', desc: '基础。', potential: [] },
          { name: '冲刺攻击：潜袭', desc: '强化。', potential: [119100] },
        ],
      },
    })
    const cinema = synthesizePotentialCinema(rows, [
      { no: 'I', label: '鲨气汹汹 I', name: '', desc: '' },
      { no: 'II', label: '鲨气汹汹 II', name: '潜能觉醒：极冰带', desc: '已有描述，保持不变。' },
    ])
    expect(cinema[0].desc).toContain('新增：普通攻击：冰刃浪、普通攻击：霜锋')
    expect(cinema[0].desc).toContain('强化：冲刺攻击：潜袭')
    expect(cinema[1].desc).toBe('已有描述，保持不变。')
  })

  it('synthesizePotentialCinema 概述中派生技能子块以机制名呈现，不漏出派生技能名', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '强化特殊技：超规工程清障', desc: '投掷手雷，额外投掷一枚[涡流集束手雷]。', potential: [0] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [119100],
          },
        ],
      },
    })
    const cinema = synthesizePotentialCinema(rows, [
      { no: 'I', label: 'xxx I', name: '', desc: '' },
    ])
    expect(cinema[0].desc).toContain('新增：涡流集束手雷')
    expect(cinema[0].desc).not.toContain('基础倍率')
  })

  it('synthesizePotentialCinema 档 I 概述含「扩展：核心被动、额外能力」（核心技潜能）', () => {
    const rows = buildSkillRows({
      basic: { description: [{ name: '普通攻击：冰刃浪', desc: '新招式。', potential: [119100] }] },
    })
    const core = buildCoreSkill({
      level: {
        '1': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['基础', '旧'], potential: [0] },
        '8': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['扩', '新'], potential: [119100] },
      },
    })
    const cinema = synthesizePotentialCinema(rows, [
      { no: 'I', label: '鲨气汹汹 I', name: '', desc: '' },
    ], core)
    expect(cinema[0].desc).toContain('新增：普通攻击：冰刃浪')
    expect(cinema[0].desc).toContain('扩展：核心被动、额外能力')
  })
})

describe('buildSkillMetricTable', () => {
  /** 构造单 Skill 引用条目：skill 共享、prop 区分指标（1001=伤害 / 1002=失衡） */
  const entry = (
    name: string,
    skill: number,
    prop: number,
    main: number,
    growth = 0,
    format = '%',
  ): NonNullable<SkillGroup['entries']>[number] => ({
    name,
    formula: `{Skill:${skill}, Prop:${prop}}`,
    props: { [skill]: { main, growth, format } },
    format,
  })

  it('transposes same-skill damage+stun entries into a hit×metric table', () => {
    const group: SkillGroup = {
      name: '普通攻击：伏特速攻',
      desc: '点按发动。',
      entries: [
        entry('一段伤害倍率', 1401001, 1001, 3120),
        entry('一段失衡倍率', 1401001, 1002, 3970),
        entry('二段伤害倍率', 1401002, 1001, 3370),
        entry('二段失衡倍率', 1401002, 1002, 6980),
      ],
    }
    const table = buildSkillMetricTable(group, 1)
    expect(table).not.toBeNull()
    expect(table?.columns).toEqual([
      { label: '伤害倍率', propId: 1001 },
      { label: '失衡倍率', propId: 1002 },
    ])
    expect(table?.rows).toEqual([
      { label: '一段', values: { '1001': '31.2%', '1002': '39.7%' } },
      { label: '二段', values: { '1001': '33.7%', '1002': '69.8%' } },
    ])
  })

  it('computes values at the selected level with growth', () => {
    const group: SkillGroup = {
      name: '普攻',
      entries: [
        entry('一段伤害倍率', 1401001, 1001, 3120, 290),
        entry('一段失衡倍率', 1401001, 1002, 3970, 190),
        entry('二段伤害倍率', 1401002, 1001, 5000, 100),
        entry('二段失衡倍率', 1401002, 1002, 6000, 50),
      ],
    }
    const table = buildSkillMetricTable(group, 12)
    expect(table?.rows[0].values).toEqual({ '1001': '63.1%', '1002': '60.6%' })
    expect(table?.rows[1].values).toEqual({ '1001': '61%', '1002': '65.5%' })
  })

  it('transposes by name subject for shared-skill groups (Ellen 霜锋: 体型×倍率)', () => {
    // 霜锋按小/中/大体型拆分倍率，公式共用同一 Skill——行分组按名称 LCP 配对，
    // 应拆成 3 行 × 2 列
    const group: SkillGroup = {
      name: '普通攻击：霜锋',
      entries: [
        entry('对小体型敌人伤害倍率', 1191027, 1001, 6040, 550),
        entry('对中体型敌人伤害倍率', 1191027, 1001, 6040, 550),
        entry('对大体型敌人伤害倍率', 1191027, 1001, 6040, 550),
        entry('对小体型敌人失衡倍率', 1191027, 1002, 2580, 120),
        entry('对中体型敌人失衡倍率', 1191027, 1002, 2580, 120),
        entry('对大体型敌人失衡倍率', 1191027, 1002, 2580, 120),
      ],
    }
    const table = buildSkillMetricTable(group, 12)
    expect(table).not.toBeNull()
    expect(table?.columns.map((c) => c.label)).toEqual(['伤害倍率', '失衡倍率'])
    expect(table?.rows.map((r) => r.label)).toEqual([
      '对小体型敌人',
      '对中体型敌人',
      '对大体型敌人',
    ])
    // 测试用简化公式（无 ×3）：主值 + 成长代入 Lv.12
    expect(table?.rows[0].values).toEqual({ '1001': '120.9%', '1002': '39%' })
  })

  it('strips shared name prefix as row label and suffix as column header', () => {
    const group: SkillGroup = {
      name: '普攻',
      entries: [
        entry('斩击伤害倍率', 1291001, 1001, 5000),
        entry('斩击失衡倍率', 1291001, 1002, 6000),
        entry('射击伤害倍率', 1291002, 1001, 7000),
        entry('射击失衡倍率', 1291002, 1002, 8000),
      ],
    }
    const table = buildSkillMetricTable(group, 1)
    expect(table?.columns.map((c) => c.label)).toEqual(['伤害倍率', '失衡倍率'])
    expect(table?.rows.map((r) => r.label)).toEqual(['斩击', '射击'])
  })

  it('breaks LCP ties via Skill-set overlap and disambiguates duplicate row labels with suffix (南宫羽 请勿抵抗)', () => {
    // 「一段失衡倍率（物理）」对「一段伤害倍率（物理）」与「一段伤害倍率（以太）」LCP 均为「一段」，
    // 靠 Skill 集合交集裁决归属；行标签再补「（物理）/（以太）」区分
    const group: SkillGroup = {
      name: '普通攻击：请勿抵抗',
      entries: [
        entry('一段伤害倍率（物理）', 1241004, 1001, 10400),
        entry('二段伤害倍率（物理）', 1241005, 1001, 20400),
        entry('三段伤害倍率（物理）', 1241006, 1001, 30400),
        entry('一段伤害倍率（以太）', 1241007, 1001, 11400),
        entry('二段伤害倍率（以太）', 1241008, 1001, 21400),
        entry('三段伤害倍率（以太）', 1241009, 1001, 31400),
        entry('一段失衡倍率（物理）', 1241004, 1002, 4400),
        entry('二段失衡倍率（物理）', 1241005, 1002, 5400),
        entry('三段失衡倍率（物理）', 1241006, 1002, 6400),
        entry('一段失衡倍率（以太）', 1241007, 1002, 11400),
        entry('二段失衡倍率（以太）', 1241008, 1002, 12400),
        entry('三段失衡倍率（以太）', 1241009, 1002, 13400),
      ],
    }
    const table = buildSkillMetricTable(group, 1)
    expect(table).not.toBeNull()
    expect(table?.columns.map((c) => c.label)).toEqual(['伤害倍率', '失衡倍率'])
    expect(table?.rows.map((r) => r.label)).toEqual([
      '一段（物理）',
      '二段（物理）',
      '三段（物理）',
      '一段（以太）',
      '二段（以太）',
      '三段（以太）',
    ])
    // 物理行与以太行数值归属正确（物理一段伤害 = 104%）
    expect(table?.rows[0].values['1001']).toBe('104%')
    expect(table?.rows[3].values['1001']).toBe('114%')
  })

  it('returns null when row labels still collide after suffix completion', () => {
    // 两行仅 Skill 不同、名称完全相同：tiebreaker 交集并列 → 无法配对 → 退回列表
    const group: SkillGroup = {
      name: '同名双形态',
      entries: [
        entry('一段伤害倍率', 1501001, 1001, 5000),
        entry('一段失衡倍率', 1501001, 1002, 6000),
        entry('一段伤害倍率', 1501002, 1001, 7000),
        entry('一段失衡倍率', 1501002, 1002, 8000),
      ],
    }
    expect(buildSkillMetricTable(group, 1)).toBeNull()
  })

  it('breaks subset-tie via Jaccard: 三段（协同） row scores lower than exact-match 三段 (南宫羽 可爱地雷飞天撞)', () => {
    // 三段失衡倍率 {1511006} 与「三段」行 {1511006} Jaccard=1.0、与「三段（协同）」行
    // {1511006,1511018} Jaccard=0.5 → 归「三段」行；overlap 版会因交集都是 1 判平局而退回
    const mk = (
      name: string,
      prop: number,
      skills: Array<[number, number]>, // [skillId, main]
      growth = 0,
      format = '%',
    ): NonNullable<SkillGroup['entries']>[number] => ({
      name,
      formula: skills.map(([s]) => `{Skill:${s}, Prop:${prop}}`).join(' + '),
      props: Object.fromEntries(skills.map(([s, main]) => [s, { main, growth, format }])),
      format,
    })
    const group: SkillGroup = {
      name: '普通攻击：可爱地雷飞天撞',
      entries: [
        mk('一段伤害倍率', 1001, [[1511004, 10400]]),
        mk('二段伤害倍率', 1001, [[1511005, 30440]]),
        mk('三段伤害倍率', 1001, [[1511006, 51080]]),
        mk('三段伤害倍率（协同）', 1001, [[1511006, 51080], [1511018, 7670]]),
        mk('一段失衡倍率', 1002, [[1511004, 4400]]),
        mk('二段失衡倍率', 1002, [[1511005, 21080]]),
        mk('三段失衡倍率', 1002, [[1511006, 41080]]),
        mk('三段失衡倍率（协同）', 1002, [[1511006, 41080], [1511018, 2060]]),
      ],
    }
    const table = buildSkillMetricTable(group, 1)
    expect(table).not.toBeNull()
    expect(table?.columns.map((c) => c.label)).toEqual(['伤害倍率', '失衡倍率'])
    expect(table?.rows.map((r) => r.label)).toEqual(['一段', '二段', '三段', '三段（协同）'])
    // 三段失衡只引用 1511006 → 归「三段」行（410.8%），不带协同加成
    expect(table?.rows[2].values['1002']).toBe('410.8%')
    // 三段（协同）失衡 = 410.8% + 20.6% = 431.4%
    expect(table?.rows[3].values['1002']).toBe('431.4%')
  })

  it('returns null for groups where each skill has only one entry (no metric dimension)', () => {
    const group: SkillGroup = {
      name: '闪避',
      entries: [
        entry('轻招架失衡倍率', 1401001, 1002, 3970),
        entry('重招架失衡倍率', 1401002, 1002, 6980),
      ],
    }
    expect(buildSkillMetricTable(group, 1)).toBeNull()
  })

  it('returns null for 1×M degenerate matrix (single row: no segment comparison)', () => {
    // 妮可「冲刺攻击：为所欲为」真实形态的回归：单行双指标必须退回列表
    const group: SkillGroup = {
      name: '冲刺攻击：为所欲为',
      entries: [
        entry('前闪攻击伤害倍率', 1031201, 1001, 4120, 380),
        entry('前闪攻击失衡倍率', 1031201, 1002, 2900, 140),
      ],
    }
    expect(buildSkillMetricTable(group, 12)).toBeNull()
  })

  it('keeps shared multiplier metrics in the matrix and moves static/partial metrics to extras (Ellen)', () => {
    const group: SkillGroup = {
      name: '冲刺攻击：冰渊潜袭',
      entries: [
        entry('回旋斩击伤害倍率', 1191007, 1001, 6230, 570),
        entry('快速剪击伤害倍率', 1191008, 1001, 12760, 1160),
        entry('蓄力剪击伤害倍率', 1191009, 1001, 15820, 1440),
        entry('回旋斩击失衡倍率', 1191007, 1002, 6230, 290),
        entry('快速剪击失衡倍率', 1191008, 1002, 9820, 450),
        entry('蓄力剪击失衡倍率', 1191009, 1002, 12170, 560),
        { name: '快速剪击获得急冻充能', formula: '1点', props: {} },
        { name: '蓄力剪击获得急冻充能', formula: '3点', props: {} },
      ],
    }
    const table = buildSkillMetricTable(group, 12)
    expect(table).not.toBeNull()
    expect(table?.columns.map((c) => c.label)).toEqual(['伤害倍率', '失衡倍率'])
    expect(table?.rows.map((r) => r.label)).toEqual(['回旋斩击', '快速剪击', '蓄力剪击'])
    // 与游戏内 Lv.12 锚点一致（用户提供的数值）
    expect(table?.rows[0].values).toEqual({ '1001': '125%', '1002': '94.2%' })
    expect(table?.rows[1].values).toEqual({ '1001': '255.2%', '1002': '147.7%' })
    expect(table?.rows[2].values).toEqual({ '1001': '316.6%', '1002': '183.3%' })
    expect(table?.extras?.map((e) => e.name)).toEqual([
      '快速剪击获得急冻充能',
      '蓄力剪击获得急冻充能',
    ])
  })

  it('returns null when no entry has a skill ref (pure static group, e.g. bangboo)', () => {
    const group: SkillGroup = {
      name: '邦布技能',
      entries: [
        { name: '冷却时间', formula: '20秒', props: {} },
        { name: '额外能力', formula: '60%', props: {} },
      ],
    }
    expect(buildSkillMetricTable(group, 1)).toBeNull()
  })

  it('returns null for empty/missing entries', () => {
    expect(buildSkillMetricTable({ name: 'x' }, 1)).toBeNull()
    expect(buildSkillMetricTable({ name: 'x', entries: [] }, 1)).toBeNull()
  })
})

describe('buildBangbooSkills', () => {
  it('keeps a/b/c order and collapses levels to name + base desc', () => {
    const rows = buildBangbooSkills({
      c: { level: { '1': { name: '冰暴回旋', desc: 'dc' } } },
      a: {
        level: {
          '1': { name: '冰刀舞', desc: 'da1' },
          '2': { name: '冰刀舞', desc: 'da2' },
        },
      },
    })
    expect(rows.map((r) => r.key)).toEqual(['a', 'c'])
    expect(rows[0]).toMatchObject({ key: 'a', zh: '主动技', names: ['冰刀舞'], desc: 'da1' })
    expect(rows[1].zh).toBe('邦布连携技')
  })

  it('returns [] for empty/missing input', () => {
    expect(buildBangbooSkills(null)).toEqual([])
    expect(buildBangbooSkills({})).toEqual([])
  })
})

/* ---------- 角色等级属性（「11号」1041 真实数据，锚点对照游戏内面板） ---------- */

describe('buildBangbooSkills (with skill_prop)', () => {
  it('parses stats per | token with property names', () => {
    const rows = buildBangbooSkills(PENGUIN_SKILL, PENGUIN_SKILL_PROP)
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c'])
    expect(rows[0].levelCount).toBe(2)
    expect(rows[1].levelCount).toBe(5)
    expect(rows[0].stats.map((s) => s.name)).toEqual(['伤害倍率', '失衡倍率', '冷却时间'])
    expect(rows[0].stats.map((s) => s.referenced)).toEqual([true, true, false])
    expect(rows[1].stats).toEqual([{ name: '属性异常积蓄值提升', referenced: false }])
  })

  it('keeps per-level descs and tokens', () => {
    const rows = buildBangbooSkills(PENGUIN_SKILL, PENGUIN_SKILL_PROP)
    expect(rows[1].descs).toHaveLength(5)
    expect(rows[1].tokens[4]).toEqual(['120%'])
    expect(rows[0].desc).toBe('招式发动时…')
  })

  it('falls back to index names when param count is missing', () => {
    const rows = buildBangbooSkills(
      { a: { level: { '1': { name: 'X', property: [], param: 'a|b|c' } } } },
      undefined,
    )
    expect(rows[0].stats.map((s) => s.name)).toEqual(['属性 1', '属性 2', '属性 3'])
  })
})

describe('bangbooSkillStatValue', () => {
  it('evaluates referenced tokens via skill_prop with level growth', () => {
    const rows = buildBangbooSkills(PENGUIN_SKILL, PENGUIN_SKILL_PROP)
    const a = rows[0]
    expect(bangbooSkillStatValue(a, 0, 1)).toBe('462%')
    expect(bangbooSkillStatValue(a, 0, 2)).toBe('508.2%')
    expect(bangbooSkillStatValue(a, 1, 1)).toBe('270%')
    expect(bangbooSkillStatValue(a, 1, 2)).toBe('297%')
    expect(bangbooSkillStatValue(a, 2, 9)).toBe('20秒')
    expect(bangbooSkillStatValue(rows[2], 0, 1)).toBe('957%')
  })

  it('uses per-level static text for extra ability', () => {
    const rows = buildBangbooSkills(PENGUIN_SKILL, PENGUIN_SKILL_PROP)
    const b = rows[1]
    expect(bangbooSkillStatValue(b, 0, 1)).toBe('60%')
    expect(bangbooSkillStatValue(b, 0, 5)).toBe('120%')
  })

  it('handles nested formulas ({{Skill…}/100}*140)', () => {
    const rows = buildBangbooSkills(LUCKY_SKILL_A, LUCKY_SKILL_PROP)
    const a = rows[0]
    expect(a.stats[0].referenced).toBe(true)
    expect(bangbooSkillStatValue(a, 0, 1)).toBe('616%')
    expect(bangbooSkillStatValue(a, 0, 10)).toBe('1170.4%')
    expect(bangbooSkillStatValue(a, 2, 1)).toBe('22秒')
  })

  it('returns placeholder for out-of-bound index', () => {
    const rows = buildBangbooSkills(PENGUIN_SKILL, PENGUIN_SKILL_PROP)
    expect(bangbooSkillStatValue(rows[0], 9, 1)).toBe('—')
  })
})

const PENGUIN_SKILL = {
  a: {
    level: {
      '1': { name: '冰刀舞', desc: '招式发动时…', property: ['伤害倍率', '失衡倍率', '冷却时间'], param: '{Skill:5300101, Prop:1001}|{Skill:5300101, Prop:1002}|20秒' },
      '2': { name: '冰刀舞', desc: '招式发动时…', property: ['伤害倍率', '失衡倍率', '冷却时间'], param: '{Skill:5300101, Prop:1001}|{Skill:5300101, Prop:1002}|20秒' },
    },
  },
  b: {
    level: {
      '1': { name: '干冰场地', desc: '…提升60%。', property: ['属性异常积蓄值提升'], param: '60%' },
      '2': { name: '干冰场地', desc: '…提升75%。', property: ['属性异常积蓄值提升'], param: '75%' },
      '3': { name: '干冰场地', desc: '…提升90%。', property: ['属性异常积蓄值提升'], param: '90%' },
      '4': { name: '干冰场地', desc: '…提升105%。', property: ['属性异常积蓄值提升'], param: '105%' },
      '5': { name: '干冰场地', desc: '…提升120%。', property: ['属性异常积蓄值提升'], param: '120%' },
    },
  },
  c: {
    level: {
      '1': { name: '冰暴回旋', desc: '冰属性伤害…', property: ['伤害倍率', '失衡倍率'], param: '{Skill:5300102, Prop:1001}|{Skill:5300102, Prop:1002}' },
    },
  },
}

const LUCKY_SKILL_A = {
  a: {
    level: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        String(i + 1),
        { name: '灵运连接', property: ['伤害倍率', '失衡倍率', '冷却时间'], param: '{{Skill:5300201, Prop:1001}/100}*140|{{Skill:5300201, Prop:1002}/100}*140|22秒' },
      ]),
    ),
  },
}

const LUCKY_SKILL_PROP = {
  '5300201': {
    '1001': { main: 44000, growth: 4400, format: '%' },
    '1002': { main: 25700, growth: 2570, format: '%' },
  },
}

const PENGUIN_SKILL_PROP = {
  '5300101': {
    '1001': { main: 46200, growth: 4620, format: '%' },
    '1002': { main: 27000, growth: 2700, format: '%' },
  },
  '5300102': {
    '1001': { main: 95700, growth: 9570, format: '%' },
    '1002': { main: 13700, growth: 1370, format: '%' },
  },
}

/** 招财布（53002）嵌套公式（与 public/data 一致，a 技能 10 级同参） */
