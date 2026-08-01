const assert = require("assert");
const { IntelMonitor } = require("../src/intel-monitor");

async function run() {
  const monitor = new IntelMonitor({ workspace: "test-workspace" });
  let pass = 0, fail = 0;

  // ── 测试 1: 未经批准，provider 不运行 ──
  const d1 = await monitor.requestSend({ channel: "telegram", message: "hello", principal: "alice" });
  assert.strictEqual(d1.allowed, false, "外部发送应默认需要批准");
  const r1 = await monitor.send({ decision: d1, message: "hello", channel: "telegram" });
  assert.strictEqual(r1.ok, false, "未批准应拒绝");
  assert.strictEqual(r1.reason, "no_approval");
  assert.strictEqual(monitor.sent.length, 0, "未批准时不应有任何发送");
  pass++; console.log("✅ 测试1: 未经批准不发送");

  // ── 测试 2: 批准后精确动作执行一次 ──
  const d2 = await monitor.requestSend({ channel: "telegram", message: "approved-msg", principal: "alice" });
  monitor.approve(d2, "bob");
  const r2 = await monitor.send({ decision: d2, message: "approved-msg", channel: "telegram" });
  assert.strictEqual(r2.ok, true, "批准后应发送");
  assert.strictEqual(monitor.sent.length, 1, "应发送 1 次");
  pass++; console.log("✅ 测试2: 批准后执行一次");

  // ── 测试 3: 内容被篡改 → 拒绝 ──
  const d3 = await monitor.requestSend({ channel: "telegram", message: "original", principal: "alice" });
  monitor.approve(d3, "bob");
  const r3 = await monitor.send({ decision: d3, message: "TAMPERED", channel: "telegram" });
  assert.strictEqual(r3.ok, false, "篡改内容应拒绝");
  assert.strictEqual(r3.reason, "input_changed");
  assert.strictEqual(monitor.sent.length, 1, "不应有新的发送");
  pass++; console.log("✅ 测试3: 篡改内容被拒绝");

  // ── 测试 4: 重放（重复消费）→ 拒绝 ──
  const d4 = await monitor.requestSend({ channel: "telegram", message: "once-msg", principal: "alice" });
  monitor.approve(d4, "bob");
  await monitor.send({ decision: d4, message: "once-msg", channel: "telegram" }); // 第一次成功
  const r4 = await monitor.send({ decision: d4, message: "once-msg", channel: "telegram" }); // 重放
  assert.strictEqual(r4.ok, false, "重放应拒绝");
  assert.strictEqual(r4.reason, "replay_rejected");
  assert.strictEqual(monitor.sent.length, 2, "总发送应保持 2 次");
  pass++; console.log("✅ 测试4: 重放被拒绝");

  // ── 测试 5: 缺失/未知权限字段 → 失败关闭 ──
  const d5 = await monitor.requestSend({ channel: "", message: "", principal: "" });
  assert.strictEqual(d5.allowed, false, "空动作应拒绝");
  pass++; console.log("✅ 测试5: 缺失字段失败关闭");

  console.log(`\n📊 结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error("❌", e.message); process.exit(1); });
