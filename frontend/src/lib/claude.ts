import type { GameSummary, AggregatedStats } from '../types';

export type AIProvider = 'anthropic' | 'deepseek';

export function getProvider(): AIProvider {
  return (localStorage.getItem('ai_provider') as AIProvider) ?? 'deepseek';
}

export function setProvider(p: AIProvider) {
  localStorage.setItem('ai_provider', p);
}

export function getApiKey(): string | null {
  return localStorage.getItem('ai_api_key');
}

export function setApiKey(key: string) {
  localStorage.setItem('ai_api_key', key.trim());
}

export function clearApiKey() {
  localStorage.removeItem('ai_api_key');
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

async function callAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('未配置 API Key，请在设置中添加');

  const provider = getProvider();

  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`Claude API 错误: ${resp.status} ${await resp.text()}`);
    const data = await resp.json();
    return data.content?.[0]?.text ?? '';
  }

  // DeepSeek (OpenAI-compatible)
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`DeepSeek API 错误: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function generateGameSummary(game: GameSummary): Promise<string> {
  const system = '你是一位专业国际象棋教练，用简洁鼓励的语气给青少年棋手提供反馈。';
  const prompt = `分析这局对弈，用1-2句话给出核心教训（中文，鼓励语气）：

结果：${game.result}，执${game.player_color === 'white' ? '白' : '黑'}棋
开局：${game.opening}（ECO: ${game.eco}）
各阶段失分率：开局 ${game.phase_acl.opening}cp，中局 ${game.phase_acl.middlegame}cp，残局 ${game.phase_acl.endgame}cp
决定性失误：${game.blunders.filter(b => b.magnitude >= 500).length} 个
僵尸棋子：${game.zombie_pieces.join('、') || '无'}
计划断裂：${game.plan_break_move ? `第${game.plan_break_move}步` : '无'}

只输出1-2句话的教训总结，不加任何前缀。`;
  return callAI(prompt, system);
}

export async function generateTrainingPlan(
  stats: AggregatedStats,
  params: {
    days_to_tournament: number;
    weekly_hours: number;
    session_minutes: number;
    has_coach: boolean;
  },
): Promise<string> {
  const system = `你是一位专业国际象棋教练，擅长为青少年棋手制定赛前训练计划。
遵循 Jeremy Silman 的不平衡理论和 Susan Polgar 的主题绑定训练法。
用鼓励语气，区分系统性弱点和偶发失误，输出 Markdown 格式的周计划。`;

  const prompt = `根据以下${stats.total_games}局对局的聚合分析，制定备赛训练计划：

**分析数据（${stats.date_range}）：**
- 各阶段平均失分：开局 ${stats.phase_acl_avg.opening}cp，中局 ${stats.phase_acl_avg.middlegame}cp，残局 ${stats.phase_acl_avg.endgame}cp
- 战术失误趋势：${stats.error_type_trend.tactical.join(', ')}
- 战略失误趋势：${stats.error_type_trend.strategic.join(', ')}
- 心理失误趋势：${stats.error_type_trend.psychological.join(', ')}
- 指标趋势：${JSON.stringify(stats.indicator_trends)}
- 最弱开局：${stats.weakest_openings.join('、') || '数据不足'}

**备赛参数：**
- 距比赛：${params.days_to_tournament} 天
- 每周可用时间：${params.weekly_hours} 小时
- 每次训练：${params.session_minutes} 分钟
- ${params.has_coach ? '有专业教练指导' : '自主训练，无专业教练'}

按4个阶段（强化期1-2周、整合期3周、巩固期4周、减压期赛前3-5天）生成周计划，每周包含：核心目标、每日战术题、开局学习、残局专项、对局安排、复盘规范、3条个性化盘中意识提醒、自检清单。用Markdown输出，语气鼓励。`;

  return callAI(prompt, system);
}
