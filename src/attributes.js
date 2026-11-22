// 神寵 Alpha 0.9.8 — 御靈師能力成長與自由配點（不改人物外觀）。
export const STAT_NAMES = Object.freeze(['STR', 'DEX', 'INT', 'LUK']);
export const AP_PER_LEVEL = 5;
export const MAX_LEVEL = 200;
export const AUTO_GROWTH = Object.freeze({
  STR: 0, DEX: 5, INT: 2, LUK: 4, // 每隔 N 次升級自動增加 1 點；STR 由玩家自由配置
});
const nint = (x, fallback=0) => Number.isFinite(Number(x)) ? Math.floor(Number(x)) : fallback;
const clamp = (x,a,b) => Math.min(b,Math.max(a,nint(x,a)));
const safeAttrs = (v) => Object.fromEntries(STAT_NAMES.map(k=>[k,clamp(v?.[k],0,999999)]));
export function computeStats(base, allocations, level, baseHp=100, baseMp=85){
  const lv=clamp(level,1,MAX_LEVEL), gained=lv-1;
  const baseAttributes=safeAttrs(base), points=safeAttrs(allocations);
  const used=STAT_NAMES.reduce((acc,k)=>acc+points[k],0);
  const total=gained*AP_PER_LEVEL;
  if(used>total) throw new RangeError('分配點數超過已獲得 AP');
  const automatic={STR:0,DEX:Math.floor(gained/5),INT:Math.floor(gained/2),LUK:Math.floor(gained/4)};
  const attributes=Object.fromEntries(STAT_NAMES.map(k=>[k,baseAttributes[k]+points[k]+automatic[k]]));
  const hpMax=Math.max(1,clamp(baseHp,1,100000)+gained*12+(attributes.STR-baseAttributes.STR)*3);
  const mpMax=Math.max(1,clamp(baseMp,1,100000)+gained*8+(attributes.INT-baseAttributes.INT)*5);
  const magicBonus=Math.floor(gained*.9)+Math.floor((attributes.INT-baseAttributes.INT)*.7)+Math.floor((attributes.LUK-baseAttributes.LUK)*.25);
  return {level:lv,baseAttributes,allocations:points,automatic,attributes,totalAP:total,usedAP:used,freeAP:total-used,hpMax,mpMax,magicBonus};
}
const SAVE_KEY='shenchong_stats_v1', CHARACTER_KEY='shenchong_character_v1';
function readCharacter(){try{return JSON.parse(localStorage.getItem(CHARACTER_KEY)||'null')}catch{return null}}
function identity(ch){return `${ch?.createdAt||''}|${ch?.displayName||''}|${ch?.jobId||''}`;}
const html = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL={STR:'力量',DEX:'敏捷',INT:'智力',LUK:'幸運'};
export class AttributeSystem {
  constructor(scene){
    this.scene=scene;this.model=null;this.state=null;this.open=false;this.lastLevel=0;
    this.panel=document.createElement('div');this.panel.id='sc-attributes-panel';
    this.panel.style.cssText='position:fixed;inset:0;z-index:99998;display:none;justify-content:center;align-items:center;background:#071526d9;padding:16px;box-sizing:border-box;color:#f5e9d5;font-family:Microsoft JhengHei,Noto Sans TC,sans-serif';
    document.body.appendChild(this.panel);
    this.panel.addEventListener('click',e=>{
      if(e.target===this.panel||e.target.closest('[data-stats-close]')){this.toggle(false);return;}
      const btn=e.target.closest('[data-stat]');if(btn)this.allocate(btn.dataset.stat,Number(btn.dataset.amount));
    });
    this.keyFn=e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||this.scene.characterUI?.isBlocking?.()||this.scene.inventory?.open||this.scene.equipment?.open||this.scene.wardrobe?.open||this.scene.dialogOpen)return;this.toggle();};
    this.updateFn=()=>this.sync();
    this.createdFn=()=>{this.state=null;this.model=null;this.sync(true);};
    scene.keybinds.register('stats',this.keyFn);
    scene.events.on('update',this.updateFn);
    window.addEventListener('shenchong:character-created',this.createdFn);
    scene.events.once('shutdown',()=>this.destroy());
    this.sync(true);
  }
  sync(force=false){
    const ch=readCharacter();if(!ch?.jobId)return;
    const id=identity(ch),level=clamp(this.scene.progression?.level??ch.level,1,MAX_LEVEL);
    if(!force&&this.state?.identity===id&&this.lastLevel===level)return;
    if(this.state?.identity!==id){
      let saved;try{saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{}
      if(saved?.identity!==id||!saved?.baseAttributes||!saved?.allocations){
        saved={identity:id,baseAttributes:safeAttrs(ch.attributes),baseHp:clamp(ch.hpMax,1,100000),baseMp:clamp(ch.mpMax,1,100000),allocations:{STR:0,DEX:0,INT:0,LUK:0},version:1};
      }
      this.state=saved;
    }
    this.lastLevel=level;
    try{this.model=computeStats(this.state.baseAttributes,this.state.allocations,level,this.state.baseHp,this.state.baseMp)}
    catch(e){console.warn('能力值資料異常，未覆蓋原角色資料',e);return;}
    this.persist();
    if(this.open)this.render();
  }
  persist(){
    if(!this.model||!this.state)return;
    try{
      localStorage.setItem(SAVE_KEY,JSON.stringify(this.state));
      const ch=readCharacter();if(!ch||identity(ch)!==this.state.identity)return;
      ch.attributes={...this.model.attributes};ch.hpMax=this.model.hpMax;ch.mpMax=this.model.mpMax;
      // 保留 Lv 與 EXP 的唯一來源 LevelSystem，不覆寫也不清空其他存檔欄位。
      localStorage.setItem(CHARACTER_KEY,JSON.stringify(ch));
      if(this.scene.characterUI?.character){const c=this.scene.characterUI.character;c.attributes={...ch.attributes};c.hpMax=ch.hpMax;c.mpMax=ch.mpMax;}
      if(this.scene.basicAttack?.opts){
        this.scene.basicAttack.opts.damage1=15+this.model.magicBonus;
        this.scene.basicAttack.opts.damage2=20+this.model.magicBonus;
      }
      this.scene.characterUI?.updateHud?.();
      if(this.scene.characterUI?.open&&this.scene.characterUI.tab==='status')this.scene.characterUI.renderProfile?.();
    }catch(e){console.warn('能力值存檔失敗',e)}
  }
  allocate(stat,amount=1){
    if(!STAT_NAMES.includes(stat)||!Number.isInteger(amount)||amount<=0||!this.model||this.model.freeAP<amount)return false;
    this.state.allocations[stat]+=amount;
    this.model=computeStats(this.state.baseAttributes,this.state.allocations,this.lastLevel,this.state.baseHp,this.state.baseMp);
    this.persist();this.render();return true;
  }
  toggle(value){this.open=typeof value==='boolean'?value:!this.open;this.panel.style.display=this.open?'flex':'none';if(this.open){this.sync(true);this.render();}}
  render(){
    if(!this.model){this.panel.innerHTML='<section>尚未建立角色 <button data-stats-close>關閉</button></section>';return;}
    const m=this.model;
    this.panel.innerHTML=`<section style="width:min(560px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(140deg,#2a4a66,#102336);border:2px solid #d9bd7c;border-radius:14px;box-shadow:0 18px 65px #000a;padding:20px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;gap:8px"><div><strong style="font-size:22px;color:#ffe0a3">✦ 御靈師 · 能力值</strong><div style="color:#b7d4e9;margin-top:5px">Lv.${m.level} ／ 200</div></div><button data-stats-close="1" style="background:#25465c;color:#fff;border:1px solid #90abc1;border-radius:7px;padding:7px 12px;cursor:pointer">關閉 ×</button></div><div style="margin:17px 0;padding:12px;border:1px solid #b7945b;border-radius:9px;background:#243d54">剩餘自由能力點 <strong style="color:#ffe6a8;font-size:25px">${m.freeAP}</strong> AP <div style="color:#aac6d8;font-size:12px;margin-top:4px">每升 1 級 +5 AP，已使用 ${m.usedAP}／累計 ${m.totalAP}</div></div>${STAT_NAMES.map(k=>`<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #526c83;padding:12px 0;gap:10px"><div style="min-width:0"><b style="color:#ffdfa4">${k}</b>　${LABEL[k]}　<strong>${m.attributes[k]}</strong><div style="color:#abc2d4;font-size:12px;margin-top:3px">基礎 ${m.baseAttributes[k]} + 自動 ${m.automatic[k]} + 配點 ${m.allocations[k]}</div></div><div style="display:flex;gap:5px"><button data-stat="${k}" data-amount="1" ${m.freeAP<1?'disabled':''} style="padding:7px 10px;border-radius:6px;cursor:pointer">+1</button><button data-stat="${k}" data-amount="10" ${m.freeAP<10?'disabled':''} style="padding:7px 10px;border-radius:6px;cursor:pointer">+10</button></div></div>`).join('')}<div style="line-height:1.8;margin-top:15px;color:#dcebf7">最大 HP：<b>${m.hpMax}</b>　最大 MP：<b>${m.mpMax}</b><div>靈力彈額外傷害：<b>+${m.magicBonus}</b></div></div><p style="color:#aec5d8;font-size:12px;line-height:1.7;margin-bottom:0">按 P 開關 · 目前能力點分配後立即生效且無法在此視窗免費重置 · 不影響人物或裝備美術</p></section>`;
  }
  destroy(){this.scene.keybinds.unregister('stats',this.keyFn);this.scene.events.off('update',this.updateFn);window.removeEventListener('shenchong:character-created',this.createdFn);this.panel?.remove();}
}
