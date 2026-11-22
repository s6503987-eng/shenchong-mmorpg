import test from 'node:test';
import assert from 'node:assert/strict';
import { BasicAttackSystem, projectileCrossesTarget } from '../src/basic_attack.js';
import { SpiritSkillSystem } from '../src/spirit_skills.js';

test('飛行攻擊穿越目標時命中，錯開高度時落空', () => {
  assert.equal(projectileCrossesTarget(0, 90, 0, 45, 0), true);
  assert.equal(projectileCrossesTarget(0, 90, 0, 45, 100), false);
});

test('木樁死亡期間拒絕第二次結算，重生後恢復完整生命', () => {
  const callbacks = [];
  const notices = [];
  const target = {
    hp: 180,
    dead: false,
    opts: { dummyMaxHp: 180, respawnMs: 2200 },
    refresh() {},
    scene: {
      showNotice: message => notices.push(message),
      time: { delayedCall(ms, callback) {
        assert.equal(ms, 2200);
        callbacks.push(callback);
        return {};
      } }
    }
  };
  const hit = BasicAttackSystem.prototype.applyDummyDamage.bind(target);
  assert.equal(hit(-5, '錯誤'), false);
  assert.equal(hit(15, '普攻'), true);
  assert.equal(target.hp, 165);
  assert.equal(hit(200, '技能'), true);
  assert.equal(hit(1, '重複'), false);
  assert.equal(target.hp, 0);
  assert.equal(target.dead, true);
  assert.deepEqual(notices, ['技能']);
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(target.hp, 180);
  assert.equal(target.dead, false);
  assert.equal(hit(20, '普攻'), true);
});

test('最大 MP 同步屬性和被動，更新上限時保留當前 MP', () => {
  const system = Object.create(SpiritSkillSystem.prototype);
  system.scene = { progression: {level: 10}, stats: {model: {mpMax: 180}} };
  system.ranks = {mana_flow: 2};
  system.mp = 110;
  system.syncManaLimit();
  assert.equal(system.maxMp, 200);
  assert.equal(system.mp, 110);
  system.scene.stats.model.mpMax = 220;
  system.syncManaLimit();
  assert.equal(system.maxMp, 240);
  assert.equal(system.mp, 110);
});
