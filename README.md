# 空洞档案 · Hollow Archive

绝区零（Zenless Zone Zero）数据展示型 wiki。基于 [hakush.in](https://hakush.in) 开放数据，以「空洞数据终端」的档案化视觉呈现代理人、音擎、邦布与驱动盘数据。

## 技术栈

- **Vue 3** + **TypeScript** + **Vite 6**
- **vue-router 4** 路由
- 手写设计系统（CSS 变量 + 零 UI 框架），暗色纸墨质感
- 数据经 Vercel Rewrite 代理 `https://api.hakush.in`，规避跨域并支持边缘缓存

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

开发态下 `Vite` 将 `/api/zzz/*` 代理至 `https://api.hakush.in/zzz/*`。

## 部署（Vercel）

1. 将本仓库推送到 GitHub。
2. 在 [vercel.com/new](https://vercel.com/new) 导入该仓库。
3. 框架选择 **Vite**，构建命令与输出目录在 `vercel.json` 中已配置，通常零改动即可。
4. 部署完成后，`vercel.json` 中的 rewrite 会自动把 `/api/zzz/*` 转发到 hakush.in。

## 数据源

| 端点 | 说明 |
| --- | --- |
| `/api/zzz/data/character.json` | 代理人名录 |
| `/api/zzz/data/char/{id}.json` | 代理人详情 |
| `/api/zzz/data/weapon.json` | 音擎名录 |
| `/api/zzz/data/weapon/{id}.json` | 音擎详情 |
| `/api/zzz/data/bangboo.json` | 邦布名录 |
| `/api/zzz/data/bangboo/{id}.json` | 邦布详情 |
| `/api/zzz/data/diskdrive.json` | 驱动盘名录 |
| `/api/zzz/data/diskdrive/{id}.json` | 驱动盘详情 |

> 项目为社区爱好者制作，与米哈游 / HoYoverse 无关；数据版权归原作者所有。