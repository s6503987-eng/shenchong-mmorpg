// 《神寵》 Alpha 1.0.3 — 御靈師轉職／試煉（不改人物、美術或原角色存檔）
export const STAGES = Object.freeze([
  {rank:0, level:1, name:'初心者 · 御靈師', trial:0},
  {rank:1, level:10, name:'一轉 · 靈契使', trial:1},
  {rank:2, level:30, name:'二轉 · 御靈導師', trial:2},
  {rank:3, level:60, name:'三轉 · 星靈祭司', trial:3},
  {rank:4, level:100, name:'四轉 · 萬靈賢者', trial:4},
  {rank:5, level:150, name:'五轉 · 神契宗師', trial:5}
]);
export function nextStage(rank){return STAGES[Math.max(0,Math.floor(rank||0))+1]||null}
export function canAdvance(level,rank,kills){const stage=nextStage(rank);return !!stage&&level>=stage.level&&kills>=stage.trial}
const KEY='shenchong_spirit_advancement_v1';
function id(){try{const c=JSON.parse(localStorage.getItem('shenchong_character_v1')||'null');return c?.jobId==='spirit'?`${c.createdAt||''}|${c.displayName||''}|${c.jobId}`:null}catch{return null}}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class SpiritAdvancementSystem{
 constructor(scene){this.scene=scene;this.identity=null;this.rank=0;this.kills=0;this.wasDead=false;this.open=false;
  this.root=document.createElement('div');this.root.id='sc-advancement-panel';this.root.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:#061424dd;color:#f9e9c9;font:14px Microsoft JhengHei,Arial,sans-serif;z-index:99996';document.body.appendChild(this.root);
  this.onClick=e=>{if(e.target===this.root||e.target.closest('[data-adv-close]')){this.toggle(false);return;}if(e.target.closest('[data-adv-go]'))this.advance()};this.root.addEventListener('click',this.onClick);
  this.onKey=e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
    if(this.scene.keybinds?.open||this.scene.dialogOpen||this.scene.spiritSkills?.open||this.scene.inventory?.open||this.scene.equipment?.open||this.scene.stats?.open)return;
    this.toggle();};
  scene.keybinds.register('advancement',this.onKey);
  this.onCreated=()=>{this.identity=null;this.load();this.render()};window.addEventListener('shenchong:character-created',this.onCreated);
  this.onUpdate=()=>{const ident=id();if(ident!==this.identity){this.load();this.render();}const dead=!!scene.basicAttack?.dead;
   if(this.identity&&dead&&!this.wasDead&&this.rank<5){this.kills=Math.min(10000,this.kills+1);this.save();if(this.open)this.render();}
   this.wasDead=dead;
   if(this.open&&this.cachedLevel!==this.level()){this.render();}};
  scene.events.on('update',this.onUpdate);scene.events.once('shutdown',()=>this.destroy());this.load();
 }
 level(){return Math.min(200,Math.max(1,Math.floor(Number(this.scene.progression?.level)||1)))}
 load(){this.identity=id();this.rank=0;this.kills=0;this.wasDead=!!this.scene.basicAttack?.dead;
  if(this.identity){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d?.identity===this.identity){this.rank=Math.max(0,Math.min(5,Math.floor(Number(d.rank)||0)));this.kills=Math.max(0,Math.min(10000,Math.floor(Number(d.kills)||0)))}}catch{}}
 }
 save(){if(!this.identity)return;try{localStorage.setItem(KEY,JSON.stringify({identity:this.identity,rank:this.rank,kills:this.kills,version:1}))}catch(e){console.warn('轉職紀錄儲存失敗',e)}}
 advance(){const next=nextStage(this.rank);if(!this.identity||!canAdvance(this.level(),this.rank,this.kills)){this.scene.showNotice?.('尚未達到轉職等級或試煉要求');return false}
  this.rank++;this.kills=0;this.save();this.render();this.scene.spiritSkills?.refresh?.();this.scene.showNotice?.(`轉職成功！${next.name}`);return true}
 toggle(force){if(!this.identity){this.scene.showNotice?.('請先建立御靈師角色');return}this.open=typeof force==='boolean'?force:!this.open;this.root.style.display=this.open?'flex':'none';if(this.open)this.render()}
 render(){if(!this.open)return;const n=nextStage(this.rank),lv=this.level();this.cachedLevel=lv;
  this.root.innerHTML=`<section role="dialog" aria-label="御靈師轉職試煉" style="background:linear-gradient(145deg,#244b71,#0c2037);border:2px solid #cda65c;border-radius:14px;width:min(660px,96vw);max-height:90vh;overflow:auto;padding:18px;box-sizing:border-box;box-shadow:0 15px 60px #000a"><header style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:23px;color:#ffe0a0">✦ 御靈師轉職聖殿</strong><button data-adv-close style="background:#36556c;color:white;border:1px solid #c7b18d;border-radius:6px;padding:8px;cursor:pointer">關閉 ×</button></header><p>目前職階：<b>${esc(STAGES[this.rank].name)}</b> · Lv.${lv}</p>${n?`<div style="background:#0b1a30;border-radius:9px;padding:15px;line-height:2"><b style="color:#ffe5a3">下一階段：${esc(n.name)}</b><br/>等級要求：Lv.${n.level} ${lv>=n.level?'✅':'🔒'}<br/>轉職試煉：擊破訓練木樁 ${n.trial} 次<br/>目前試煉進度：${Math.min(this.kills,n.trial)}／${n.trial}<br/><small style="color:#bed6ed">達到等級後，在晨曦村擊倒木樁完成試煉；每次轉職需重新完成該階段試煉。</small><br/><button data-adv-go ${!canAdvance(lv,this.rank,this.kills)?'disabled':''} style="background:${canAdvance(lv,this.rank,this.kills)?'#c59347':'#536577'};color:white;border:0;border-radius:8px;padding:10px 22px;margin-top:10px;cursor:pointer;font-weight:bold">${canAdvance(lv,this.rank,this.kills)?'完成試煉 · 正式轉職':'尚未滿足轉職條件'}</button></div>`:'<p style="font-size:18px;color:#ffe0a0">已完成五轉 · 神契宗師！</p>'}<hr style="border:0;border-top:1px solid #58708a;margin:18px 0"/><b>五次轉職路線</b><div style="margin-top:9px">${STAGES.slice(1).map(s=>`<div style="padding:7px;border-bottom:1px solid #42607b;color:${s.rank<=this.rank?'#a9f6c2':'#d2ddea'}">${s.rank<=this.rank?'✓':'◇'} Lv.${s.level}｜${esc(s.name)}</div>`).join('')}</div><p style="color:#bdd0e3;font-size:12px">使用自訂的轉職快捷鍵開關此頁面；按 S 查看每個職階的技能。轉職不改變角色美術和既有裝備。</p></section>`;
 }
 destroy(){this.scene.keybinds.unregister('advancement',this.onKey);this.scene.events.off('update',this.onUpdate);window.removeEventListener('shenchong:character-created',this.onCreated);this.root.remove()}
}
