// 《神寵》Alpha 0.9.7：200級角色成長。獨立於人物美術、裝備、寵物和鍵盤移動。
export const MAX_LEVEL = 200;
export const ADVANCEMENT_MILESTONES = Object.freeze([
  { level: 1, name: '初心者', rank: 0 },
  { level: 10, name: '一轉', rank: 1 },
  { level: 30, name: '二轉', rank: 2 },
  { level: 60, name: '三轉', rank: 3 },
  { level: 100, name: '四轉', rank: 4 },
  { level: 150, name: '五轉', rank: 5 }
]);
export function expToNext(level) {
  const lv = Math.floor(Number(level));
  if (!Number.isFinite(lv) || lv < 1 || lv >= MAX_LEVEL) return 0;
  return Math.round(60 + 30 * lv + 2 * lv * lv);
}
export function eligibleRank(level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return ADVANCEMENT_MILESTONES.reduce((rank, stage) => lv >= stage.level ? stage.rank : rank, 0);
}
export function addExperience(level, exp, gained) {
  let lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  let amount = Math.max(0, Math.floor(Number(exp) || 0));
  const gain = Number(gained);
  if (!Number.isFinite(gain) || gain < 0 || gain > 100000000) throw new RangeError('無效的經驗值');
  amount += Math.floor(gain);
  let levelsGained = 0;
  while (lv < MAX_LEVEL) {
    const need = expToNext(lv);
    if (amount < need) break;
    amount -= need; lv++; levelsGained++;
  }
  if (lv === MAX_LEVEL) amount = 0;
  return { level: lv, exp: amount, levelsGained, capped: lv === MAX_LEVEL };
}
const SAVE_KEY = 'shenchong_progression_v1';
const CHARACTER_KEY = 'shenchong_character_v1';
function currentCharacter() {
  try { return JSON.parse(localStorage.getItem(CHARACTER_KEY) || 'null'); }
  catch { return null; }
}
const clampInt = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value) || 0)));
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FMT = new Intl.NumberFormat('zh-TW');
export class LevelSystem {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.characterIdentity = null;
    this.level = 1;
    this.exp = 0;
    this.lastDummyDead = false;
    this.load();
    this.buildHud();
    this.buildPanel();
    this.onKey = e => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (this.scene.characterUI?.isBlocking() || this.scene.inventory?.open || this.scene.equipment?.open || this.scene.wardrobe?.open || this.scene.dialogOpen) return;
      this.toggle();
    };
    this.onCreated = () => { this.load(); this.refresh(); };
    this.onUpdate = () => {
      const dummy = this.scene.basicAttack;
      if (!dummy) return;
      // 僅在木樁由活著轉為被擊倒的那一瞬間發獎勵，避免每幀重複發放。
      if (dummy.dead && !this.lastDummyDead) this.grantExp(45, '擊破訓練木樁');
      this.lastDummyDead = !!dummy.dead;
    };
    scene.keybinds.register('level',this.onKey);
    scene.events.on('update', this.onUpdate);
    window.addEventListener('shenchong:character-created', this.onCreated);
    scene.events.once('shutdown', () => this.destroy());
    this.refresh();
  }
  load() {
    const character = currentCharacter();
    if (!character || !character.jobId) {
      this.characterIdentity = null; this.level = 1; this.exp = 0; return;
    }
    const identity = `${character.createdAt || ''}|${character.displayName || ''}|${character.jobId}`;
    this.characterIdentity = identity;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch {}
    const source = saved && saved.identity === identity ? saved : character;
    const baseLevel = clampInt(source.level, 1, MAX_LEVEL);
    const baseExp = Math.max(0, Math.floor(Number(source.exp) || 0));
    const sane = addExperience(baseLevel, 0, Math.min(baseExp, 100000000));
    this.level = sane.level; this.exp = sane.exp;
    this.persist();
  }
  persist() {
    if (!this.characterIdentity) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ identity: this.characterIdentity, level: this.level, exp: this.exp, schemaVersion: 1 }));
      const ch = currentCharacter();
      if (ch && `${ch.createdAt || ''}|${ch.displayName || ''}|${ch.jobId}` === this.characterIdentity) {
        ch.level = this.level; ch.exp = this.exp;
        localStorage.setItem(CHARACTER_KEY, JSON.stringify(ch));
        if (this.scene.characterUI?.character) {
          this.scene.characterUI.character.level = this.level;
          this.scene.characterUI.character.exp = this.exp;
        }
      }
    } catch(e) { console.warn('等級存檔未成功：', e); }
  }
  grantExp(value, reason='獲得經驗') {
    if (!this.characterIdentity || this.level >= MAX_LEVEL) return false;
    let result;
    try { result = addExperience(this.level, this.exp, value); }
    catch(e) { console.warn(e); return false; }
    this.level = result.level; this.exp = result.exp;
    this.persist(); this.refresh();
    this.scene.showNotice?.(result.levelsGained ? `升級！Lv.${this.level}（${reason} +${value} EXP）` : `${reason} +${value} EXP`);
    return true;
  }
  buildHud() {
    const s = this.scene;
    this.expText = s.add.text(18, 654, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize:'10px', color:'#f8e9bc', stroke:'#122236', strokeThickness:2 }).setScrollFactor(0).setDepth(119);
    this.expBg = s.add.rectangle(100, 658, 222, 5, 0x0a1726).setOrigin(0,0).setScrollFactor(0).setDepth(119);
    this.expFill = s.add.rectangle(100, 658, 1, 5, 0xffce69).setOrigin(0,0).setScrollFactor(0).setDepth(120);
  }
  buildPanel() {
    this.root = document.createElement('div');
    this.root.id = 'sc-level200-panel';
    this.root.setAttribute('role','dialog');
    this.root.setAttribute('aria-label','等級與轉職進度');
    this.root.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:99998;background:#07172acc;font-family:Microsoft JhengHei,Noto Sans TC,sans-serif;color:#fff;padding:16px;box-sizing:border-box';
    this.root.addEventListener('click', e=>{ if(e.target===this.root || e.target.closest('[data-close-level]')) this.toggle(false); });
    document.body.appendChild(this.root);
  }
  renderPanel() {
    const need = expToNext(this.level);
    const percent = this.level===MAX_LEVEL ? 100 : (this.exp / need * 100);
    const next = ADVANCEMENT_MILESTONES.find(m => m.level > this.level);
    const character = currentCharacter();
    const milestones = ADVANCEMENT_MILESTONES.map(m => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #476178;padding:6px 0;color:${this.level>=m.level?'#ffe0a1':'#a9c0d7'}"><span>${m.level === 1 ? 'Lv.1 起' : `Lv.${m.level}`} · ${m.name}</span><span>${m.rank<=(this.scene.advancement?.rank||0)?'已完成轉職':this.level>=m.level?'可挑戰轉職':'未達等級'}</span></div>`).join('');
    const dev = new URLSearchParams(location.search).get('scdev')==='1'
      ? '<button data-exp-test="1" style="margin-top:12px;padding:8px 12px;border:1px solid #f9d9a0;border-radius:7px;background:#2a4862;color:white;cursor:pointer">開發測試：獲得目前等級所需 EXP</button>' : '';
    this.root.innerHTML = `<section style="width:min(520px,94vw);max-height:88vh;overflow:auto;box-sizing:border-box;padding:22px;background:linear-gradient(140deg,#2b4c66,#102439);border:2px solid #d7b875;border-radius:13px;box-shadow:0 18px 70px #0009"><div style="display:flex;justify-content:space-between;gap:10px"><div><strong style="font-size:23px;color:#ffe3a5">角色等級 · Lv.${this.level} / 200</strong><div style="color:#b9d8ed;margin-top:5px">${escapeHtml(character?.displayName||'未建立角色')} · ${character?.jobId==='spirit'?'御靈師':'其他職業（暫不開發技能）'}</div></div><button data-close-level="1" style="height:33px;padding:5px 12px;border:1px solid #afc1d1;background:#234158;border-radius:6px;color:white;cursor:pointer">關閉 ×</button></div><div style="margin-top:18px;font-size:14px">${this.level===MAX_LEVEL?'已達最高等級':`EXP ${FMT.format(this.exp)} / ${FMT.format(need)}（${percent.toFixed(1)}%）`}</div><div style="height:12px;border-radius:7px;background:#081a2a;margin-top:7px;overflow:hidden"><div style="height:100%;width:${percent}%;background:#eec36c"></div></div><p style="color:#bed4e5;font-size:13px;line-height:1.7;margin:14px 0">擊破訓練木樁可獲得 45 EXP。${next?`距離下一階段「${next.name}」還需 ${next.level-this.level} 級。`:'已達最後一個轉職等級門檻。'}<br>達到等級只是取得轉職資格。請透過轉職聖殿完成試煉和正式轉職，才能解鎖對應技能。人物美術不變。</p><strong style="color:#ffe3a5">轉職等級規劃</strong>${milestones}${dev}<button data-open-advancement style="margin-top:12px;padding:8px 12px;border:1px solid #f9d9a0;border-radius:7px;background:#2a4862;color:white;cursor:pointer">開啟御靈師轉職聖殿</button><div style="font-size:12px;color:#aac4d8;margin-top:13px">按 L 開關此視窗 · 按 C 看角色資料 · 上限 200 級</div></section>`;
    this.root.querySelector('[data-open-advancement]')?.addEventListener('click',()=>{this.toggle(false);this.scene.advancement?.toggle(true)});
    this.root.querySelector('[data-exp-test]')?.addEventListener('click',()=>this.grantExp(expToNext(this.level)-this.exp,'開發測試'));
  }
  toggle(force) {
    this.open = typeof force === 'boolean' ? force : !this.open;
    this.root.style.display = this.open ? 'flex' : 'none';
    if(this.open) this.renderPanel();
  }
  refresh() {
    const ch = this.scene.characterUI;
    ch?.updateHud?.();
    if(ch?.open && ch?.character && ch?.tab==='status') ch.renderProfile?.();
    const needed = expToNext(this.level);
    const pct = this.level === MAX_LEVEL ? 1 : (needed ? this.exp / needed : 0);
    this.expText?.setText(this.level===MAX_LEVEL ? 'EXP MAX' : `EXP ${(pct*100).toFixed(1)}%`);
    this.expFill?.setDisplaySize(Math.max(1,222*pct),5);
    if(this.open) this.renderPanel();
  }
  destroy() {
    this.scene.keybinds.unregister('level',this.onKey);
    this.scene.events.off('update',this.onUpdate);
    window.removeEventListener('shenchong:character-created',this.onCreated);
    this.root?.remove();
    this.expText?.destroy();this.expFill?.destroy();this.expBg?.destroy();
  }
}
