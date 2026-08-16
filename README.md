# 空洞档案 · Hollow Archive

绝区零（Zenless Zone Zero）数据展示型 wiki。以「空洞数据终端」的档案化视觉呈现代理人、音擎、邦布与驱动盘数据。设计取向：**约束、排印、纸墨质感**——拒绝渐变霓虹与圆角卡片堆叠的模板感。

## 技术栈

- **Vue 3** + **TypeScript** + **Vite 6**
- **vue-router 4**
- 零 UI 框架：纯手写设计系统（CSS 变量 + 细线 + 等宽数据数字）
- 数据直连 `static.nanoka.cc`（hakush.in 继任者，CORS 全开，无需代理）

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

> 注：`static.nanoka.cc` 域名在海内外可达性不同，如本地无法直连（墙内环境），请配置代理访问 dev server，或部署后由 Vercel 边缘网络访问。

## 部署（Vercel）

1. 将本仓库推送到 GitHub。
2. 在 [vercel.com/new](https://vercel.com/new) 导入该仓库。
3. 无需任何配置——`vercel.json` 已声明 Vite 框架与输出目录，仅含 SPA 路由 rewrite。
4. 部署后访问 `https://<你的项目>.vercel.app`。

## 数据源

**基址 `https://static.nanoka.cc`**（hakush.in 已下线，改名迁移至 nanoka.cc）。先 `GET /manifest.json` 取 `zzz.latest` 版本号，再按版本 + 语言（`zh`）请求：

| 端点 | 说明 |
| --- | --- |
| `/manifest.json` | 各游戏版本清单（`zzz.latest`） |
| `/zzz/{ver}/character.json` | 代理人名录（id→对象 map，含四语言名） |
| `/zzz/{ver}/zh/character/{id}.json` | 代理人详情（技能/影画/数值/档案） |
| `/zzz/{ver}/weapon.json` | 音擎名录 |
| `/zzz/{ver}/zh/weapon/{id}.json` | 音擎详情 |
| `/zzz/{ver}/bangboo.json` | 邦布名录 |
| `/zzz/{ver}/zh/bangboo/{id}.json` | 邦布详情 |
| `/zzz/{ver}/equipment.json` | 驱动盘名录（套装效果在 `zh.desc2/desc4`） |
| `/zzz/{ver}/zh/equipment/{id}.json` | 驱动盘详情 |

**字段约定（实测）**：属性 `200物理 201火 202冰 203电 204风 205以太`；职业 `1强攻 2击破 3异常 4支援 5防护 6命破`；稀有度 `角色/邦布: 3=A 4=S，音擎: 2=B 3=A 4=S`。技能文本含 `<color=#…>` 等游戏标记，站点已做剥离清洗。

### 图片素材现状（重要）

`static.nanoka.cc/zzz/UI/{basename}.webp` 模板当前**全部 404**（素材 CDN 迁移未就绪）。站点已内置优雅降级——图片缺失时显示档案式文字占位（代号首两字），不产生破图；素材恢复后无需改代码自动显示。详见研究文档 `zzz_api_research.md`。

## 目录结构

```
src/
  data/          # API 客户端 + 类型（int 枚举映射）
  components/    # Rarity / Tags / HollowImage（图片降级）
  views/         # 首页、代理人列表/详情、音擎、邦布、驱动盘
  styles/        # 设计 token + 基样式
  utils/         # 富文本清洗等
```

> 项目为社区爱好者制作，与米哈游 / HoYoverse 无关；数据版权归原作者所有。