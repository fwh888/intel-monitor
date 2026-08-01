/**
 * intel-monitor — 全球情报通知服务（带 TrustGraduation 权限边界）
 *
 * 职责:
 *   1. 生成情报摘要
 *   2. 发送通知前，必须先通过权限边界（批准后才能发送）
 *   3. 防止: 未批准就发送 / 批准后内容被篡改 / 重复发送
 */
const { TrustGraduation, canExecute, buildApprovalPacket } = require("@trust-graduation/core");

class IntelMonitor {
  constructor({ workspace = "intel-monitor", evidence } = {}) {
    this.tg = new TrustGraduation({ workspace, evidence });
    this.sent = []; // 已发送记录
    this.approvals = new Map(); // 已批准的动作: hash -> consumed?
  }

  /**
   * 生成情报摘要（本地操作，无需批准）
   */
  summarize(items) {
    return items.map((i) => `📡 [${i.source}] ${i.title}`).join("\n");
  }

  /**
   * 请求发送通知 — 第一步: 检查权限
   * 返回: 决策（allowed / needsApproval）
   */
  async requestSend({ channel, message, principal }) {
    const decision = await canExecute({
      actionClass: "message.send.external",
      context: {
        principal,
        requestedBy: "intel-monitor",
        channel,
        body: message,
        constraints: { scope: "once", channel },
      },
    });
    return decision;
  }

  /**
   * 批准一个动作（绑定到精确的归一化动作）
   */
  approve(decision, approver) {
    const normalized = this._normalize(decision.requestedAction);
    const packet = buildApprovalPacket({
      decision,
      approver,
      normalizedAction: normalized,
    });
    this.approvals.set(decision.decisionId, { packet, consumed: false, normalized });
    return packet;
  }

  /**
   * 执行发送 — 第二步: 消费批准
   * 关键保障:
   *   - 未批准 → 拒绝
   *   - 内容被篡改（与批准时不一致）→ 拒绝
   *   - 重复消费 → 拒绝
   */
  async send({ decision, message, channel }) {
    const record = this.approvals.get(decision.decisionId);
    if (!record) {
      return { ok: false, reason: "no_approval", message: "未经批准，拒绝发送" };
    }
    if (record.consumed) {
      return { ok: false, reason: "replay_rejected", message: "批准已被消费，拒绝重放" };
    }
    // 校验内容未被篡改
    const current = this._normalize({ body: message, channel });
    if (JSON.stringify(current) !== JSON.stringify(record.normalized)) {
      return { ok: false, reason: "input_changed", message: "内容与批准不一致，拒绝发送" };
    }
    // 真正发送（沙箱: 只记录，不实际外发）
    record.consumed = true;
    this.sent.push({ decisionId: decision.decisionId, channel, message, at: new Date().toISOString() });
    return { ok: true, sent: this.sent[this.sent.length - 1] };
  }

  /** 归一化动作（用于防篡改比对） */
  _normalize({ body, channel }) {
    return { body: String(body || "").trim(), channel: String(channel || "").trim() };
  }
}

module.exports = { IntelMonitor };
