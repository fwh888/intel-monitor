# 📡 intel-monitor

全球情报通知服务 — 带 **TrustGraduation 权限边界** 的 MCP/Agent 工具。

## 为什么需要权限边界

Agent 自动发送通知/消息是有副作用的操作。intel-monitor 在发送前强制经过批准流程：

```
Agent 生成情报
   ↓
① requestSend() → 检查权限（默认需要批准）
   ↓
② 人工/宿主 approve() → 生成批准包（绑定精确动作）
   ↓
③ send() → 校验批准 + 防篡改 + 防重放 → 才真正发送
```

## 保障

| 场景 | 行为 |
|:--|:--|
| 未经批准 | ❌ 拒绝发送 |
| 内容被篡改 | ❌ 拒绝发送 |
| 重复消费/重放 | ❌ 拒绝发送 |
| 缺失权限字段 | ❌ 失败关闭 |

## 运行测试

```bash
npm install
npm test
```

## 架构

- `src/intel-monitor.js` — 权限边界核心（基于 `@trust-graduation/core`）
- `test/intel-monitor.test.js` — 5 项验收测试

MIT License
