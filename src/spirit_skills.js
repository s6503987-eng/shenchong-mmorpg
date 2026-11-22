// 《神寵》Alpha 1.0.2 — 御靈師技能書 / 技能點 / 施放；不更換人物貼圖
export const SKILLS=Object.freeze([
  {id:'spirit_burst',name:'靈能衝擊',kind:'active',level:1,max:10,mp:12,cd:1400,base:24,scale:9,desc:'對面向前方的目標釋放藍色靈能衝擊波。'},
  {id:'spirit_pulse',stage:1,name:'靈環震盪',kind:'active',level:10,max:10,mp:24,cd:3800,base:42,scale:12,desc:'在身前釋放環形靈力，較遠距離攻擊木樁。'},
  {id:'spirit_lance',stage:2,name:'星輝貫穿',kind:'active',level:30,max:10,mp:38,cd:6500,base:78,scale:18,desc:'蓄能後施放強力貫穿靈光。'},
  {id:'spirit_affinity',name:'靈力親和',kind:'passive',level:1,max:10,desc:'每級增加御靈師主動技能傷害 3%。'},
  {id:'mana_flow',stage:1,name:'靈息循環',kind:'passive',level:10,max:10,desc:'每級增加最大 MP 10 點，並強化回魔速度。'},
  {id:'contract_focus',name:'靈契專注',kind:'passive',stage:1,level:10,max:10,desc:'每級提升主動技能傷害 2%。'},
  {id:'spirit_echo',name:'靈獸迴響',kind:'passive',stage:2,level:30,max:10,desc:'每級提升主動技能傷害 2%。'},
  {id:'stellar_rain',name:'星靈雨',kind:'active',stage:3,level:60,max:10,mp:55,cd:8000,base:130,scale:24,desc:'向前方釋放星靈暴雨，造成強力魔法傷害。'},
  {id:'star_blessing',name:'星祈',kind:'passive',stage:3,level:60,max:10,desc:'每級提升主動技能傷害 3%。'},
  {id:'myriad_wave',name:'萬靈潮汐',kind:'active',stage:4,level:100,max:10,mp:80,cd:12000,base:210,scale:35,desc:'召喚萬靈共鳴的衝擊波。'},
  {id:'sage_wisdom',name:'賢者真知',kind:'passive',stage:4,level:100,max:10,desc:'每級提升主動技能傷害 3%。'},
  {id:'divine_pact',name:'神契裁決',kind:'active',stage:5,level:150,max:10,mp:120,cd:18000,base:320,scale:50,desc:'御靈師五轉終極靈力裁決。'},
  {id:'divine_resonance',name:'神契共鳴',kind:'passive',stage:5,level:150,max:10,desc:'每級提升主動技能傷害 4%。'}
]);
export const SP_PER_LEVEL=1;
export const getSkill=(id)=>SKILLS.find(s=>s.id===id);
export const earnedSP=(level)=>Math.max(0,Math.min(200,Math.floor(Number(level)||1))); // Lv.1 一點，Lv.200 兩百點
export function availableSP(level,ranks){const used=SKILLS.reduce((sum,s)=>sum+Math.max(0,Math.floor(Number(ranks?.[s.id])||0)),0);return Math.max(0,earnedSP(level)-used)}
export function learnSkill(level,ranks,id,advancementRank=0){const skill=getSkill(id);if(!skill||level<skill.level||advancementRank<(skill.stage||0)||availableSP(level,ranks)<1||(ranks?.[id]||0)>=skill.max)return null;return {...ranks,[id]:(ranks?.[id]||0)+1}}
export function skillDamage(id,rank,magicBonus=0,affinityRank=0){const s=getSkill(id);if(!s||s.kind!=='active'||rank<1)return 0;return Math.max(1,Math.floor((s.base+(rank-1)*s.scale+Math.max(0,magicBonus))*(1+Math.max(0,affinityRank)*.03)))}
const elEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storeKey='shenchong_spirit_skills_v1',characterKey='shenchong_character_v1';
function identity(){try{const c=JSON.parse(localStorage.getItem(characterKey)||'null');return c?.jobId==='spirit'?`${c.createdAt||''}|${c.displayName||''}|${c.jobId}`:null}catch{return null}}
const ss={position:'fixed',inset:'0',display:'none',alignItems:'center',justifyContent:'center',zIndex:'99997',background:'#06121be8',color:'#f8e9cf',fontFamily:'Microsoft JhengHei,Noto Sans TC,Arial,sans-serif',padding:'12px',boxSizing:'border-box'};
export class SpiritSkillSystem{
  constructor(scene){
    this.scene=scene;this.open=false;this.identity='';this.ranks={};this.cooldown={};this.mp=0;this.maxMp=0;this.lastLevel=0;
    this.panel=document.createElement('div');this.panel.id='sc-spirit-skill-panel';Object.assign(this.panel.style,ss);document.body.appendChild(this.panel);
    this.panel.addEventListener('click',e=>{if(e.target===this.panel||e.target.closest('[data-sk-close]')){this.toggle(false);return;}if(e.target.closest('[data-sk-advance]')){this.toggle(false);this.scene.advancement?.toggle(true);return;}const learn=e.target.closest('[data-sk-learn]');if(learn){this.learn(learn.dataset.skLearn);return;}const cast=e.target.closest('[data-sk-cast]');if(cast){this.toggle(false);this.cast(cast.dataset.skCast);}});
    this.hud=document.createElement('div');this.hud.id='sc-spirit-skill-bar';this.hud.style.cssText='position:fixed;bottom:11px;left:50%;transform:translateX(-50%);z-index:800;color:#fff;font-family:Microsoft JhengHei,Arial,sans-serif;display:flex;gap:5px;pointer-events:auto';document.body.appendChild(this.hud);
    this.hud.addEventListener('click',e=>{const b=e.target.closest('[data-sk-short]');if(b)this.cast(b.dataset.skShort)});
    this.skillActions=[];
    const activeIds=SKILLS.filter(skill=>skill.kind==='active').map(skill=>skill.id);
    activeIds.forEach((id,i)=>{
      const action=`skill${i+1}`;
      const handler=()=>this.cast(id);
      scene.keybinds.register(action,handler);
      this.skillActions.push([action,handler]);
    });
    this.onCharacter=()=>{this.load();this.refresh()};window.addEventListener('shenchong:character-created',this.onCharacter);
    this.load();this.refresh();
    this.refreshAt=0;
    this.onUpdate=(_t,delta)=>{const lv=this.level();if(lv!==this.lastLevel||identity()!==this.identity){this.load();this.lastLevel=lv;this.refresh()}
      if(this.identity&&this.mp<this.maxMp)this.mp=Math.min(this.maxMp,this.mp+Math.max(0,delta||0)/1000*(1.6+this.rank('mana_flow')*.65));
      const now=scene.time?.now||0;if(now>=this.refreshAt){this.refreshAt=now+180;this.refreshBar();this.updateLiveCounters();}
    };
    scene.events.on('update',this.onUpdate);scene.events.once('shutdown',()=>this.destroy());
  }
  level(){return Math.max(1,Math.min(200,Number(this.scene.progression?.level||1)))}
  rank(id){return Math.max(0,Number(this.ranks[id]||0))}
  maxMana(){return Math.max(85+(this.level()-1)*8,Number(this.scene.stats?.model?.mpMax)||0)+this.rank('mana_flow')*10}
  load(){const now=identity();if(now===this.identity&&now)return;this.identity=now;this.ranks={};this.cooldown={};
    if(now){try{const saved=JSON.parse(localStorage.getItem(storeKey)||'null');if(saved?.identity===now&&saved.ranks){for(const s of SKILLS)this.ranks[s.id]=Math.max(0,Math.min(s.max,Math.floor(Number(saved.ranks[s.id])||0)));}}catch{}
      // 防止外部或舊資料造成非法超額學習。
      while(availableSP(this.level(),this.ranks)===0&&Object.values(this.ranks).reduce((a,b)=>a+b,0)>earnedSP(this.level())){const s=SKILLS.findLast(s=>this.ranks[s.id]>0);if(!s)break;this.ranks[s.id]--;}
    }
    this.lastLevel=this.level();this.maxMp=this.maxMana();this.mp=this.maxMp;this.persist();
  }
  persist(){if(!this.identity)return;try{localStorage.setItem(storeKey,JSON.stringify({identity:this.identity,ranks:this.ranks,version:1}))}catch(e){console.warn('技能存檔失敗',e)}}
  learn(id){const skill=getSkill(id);if(!skill||this.scene.advancement?.rank<(skill.stage||0)){this.scene.showNotice?.('請先完成對應轉職');return false}const next=learnSkill(this.level(),this.ranks,id,this.scene.advancement?.rank||0);if(!this.identity||!next)return false;this.ranks=next;this.maxMp=this.maxMana();this.mp=Math.min(this.mp,this.maxMp);this.persist();this.refresh();this.scene.showNotice?.(`${getSkill(id).name} Lv.${this.rank(id)}`);return true}
  isBlocked(){const s=this.scene;return !!(this.open||s.dialogOpen||s.keybinds?.open||s.inventory?.open||s.equipment?.open||s.characterUI?.isBlocking?.()||s.wardrobe?.open||s.stats?.open||s.progression?.open||s.feedingOpen||s.advancement?.open)}
  cast(id){const s=this.scene,p=s.player,skill=getSkill(id),rank=this.rank(id);if(!this.identity||!skill||skill.kind!=='active'||rank<1||(this.scene.advancement?.rank||0)<(skill.stage||0)||this.isBlocked()||!p?.active)return false;
    const now=s.time?.now||0;if(now<(this.cooldown[id]||0)||this.mp<skill.mp){if(this.mp<skill.mp)s.showNotice?.('MP 不足');return false;}
    this.mp-=skill.mp;this.cooldown[id]=now+skill.cd;
    const dir=p.flipX?-1:1,startX=p.x+dir*26,startY=p.y-22,radius=id==='spirit_burst'?245:id==='spirit_pulse'?325:id==='spirit_lance'?430:Math.min(570,430+skill.stage*30);
    const fx=s.add.graphics().setDepth(47),color=id==='spirit_lance'?0xf0d9ff:id==='spirit_pulse'?0x8ceaff:0x60d8ff;
    const hitX=startX+dir*Math.min(radius,160),hitY=startY;
    let elapsed=0;const onUpdate=(_t,d)=>{elapsed+=Math.max(0,d||0);fx.clear();const pct=Math.min(1,elapsed/330);fx.lineStyle(4,color,1-pct*.7).strokeCircle(startX,startY,10+26*pct);
      if(id==='spirit_pulse'){fx.lineStyle(3,0xffffff,1-pct).strokeEllipse(startX+dir*75,startY,65+80*pct,31+42*pct)}
      else{fx.lineStyle(id==='spirit_lance'?9:5,color,1-pct*.8).lineBetween(startX,startY,startX+dir*(45+radius*pct),startY);fx.fillStyle(0xffffff,1-pct).fillCircle(startX+dir*(45+radius*pct),startY,7)}
      if(elapsed>=350){s.events.off('update',onUpdate);fx.destroy();}};
    s.events.on('update',onUpdate);s.time.delayedCall(420,()=>{s.events.off('update',onUpdate);fx.destroy()});
    const a=s.basicAttack;
    if(a&&!a.dead&&a.dummy?.active&&(a.dummyX-p.x)*dir>0&&Math.abs(a.dummyX-p.x)<=radius&&Math.abs((a.dummyY-20)-startY)<75){
      const damage=skillDamage(id,rank,s.stats?.model?.magicBonus||0,this.rank('spirit_affinity') + this.rank('contract_focus')*2/3 + this.rank('spirit_echo')*2/3 + this.rank('star_blessing') + this.rank('sage_wisdom') + this.rank('divine_resonance')*4/3);
      a.hp=Math.max(0,a.hp-damage);a.emit?.(a.dummyX,a.dummyY-20,color,20,150);a.refresh();
      const number=s.add.text(a.dummyX,a.dummyY-104,`-${damage}`,{fontSize:'24px',fontFamily:'Arial',fontStyle:'bold',color:'#d9f4ff',stroke:'#17314b',strokeThickness:4}).setOrigin(.5).setDepth(50);
      s.tweens.add({targets:number,y:number.y-32,alpha:0,duration:620,onComplete:()=>number.destroy()});
      if(a.hp===0){a.dead=true;a.refresh();s.showNotice?.('御靈師技能擊破木樁！');a.respawn?.remove(false);a.respawn=s.time.delayedCall(a.opts.respawnMs,()=>{a.hp=a.opts.dummyMaxHp;a.dead=false;a.refresh()})}
    }
    this.refreshBar();return true;
  }
  toggle(force){if(!this.identity){this.scene.showNotice?.('請先建立御靈師角色');return}this.open=typeof force==='boolean'?force:!this.open;this.panel.style.display=this.open?'flex':'none';if(this.open)this.render()}
  refresh(){this.maxMp=this.maxMana();this.mp=Math.min(this.mp,this.maxMp);this.refreshBar();if(this.open)this.render()}
  updateLiveCounters(){
    // 更新文字，而非替換整個按鈕：避免滑鼠按下時 DOM 被換掉，導致 click 事件流失。
    if(!this.open)return;
    const mp=this.panel.querySelector('[data-sk-live-mp]');
    if(mp)mp.textContent=`MP ${Math.floor(this.mp)}/${this.maxMp}`;
  }
  refreshBar(){if(!this.identity){this.hud.style.display='none';return}this.hud.style.display='flex';const now=this.scene.time?.now||0;
    this.hud.innerHTML=SKILLS.filter(s=>s.kind==='active').map((s,i)=>{const r=this.rank(s.id),cd=Math.max(0,((this.cooldown[s.id]||0)-now)/1000);return `<button data-sk-short="${s.id}" title="${elEscape(s.name)}" style="min-width:95px;background:#12314edb;border:1px solid #cfb579;border-radius:8px;padding:6px;color:#fff;cursor:pointer;font-size:12px">${elEscape(this.scene.keybinds?.bindings?.['skill'+(i+1)]||String(i+1))} · ${elEscape(s.name)}<br><small>${(this.scene.advancement?.rank||0)<(s.stage||0)?'未轉職':!r?'未學習':cd>0?cd.toFixed(1)+' 秒':'Lv.'+r}</small></button>`}).join('')+`<div style="padding:7px;background:#11263edb;border:1px solid #588cb5;border-radius:7px;font-size:12px">MP ${Math.floor(this.mp)}/${this.maxMp}</div>`;
  }
  render(){const lv=this.level(),sp=availableSP(lv,this.ranks),rank=this.scene.advancement?.rank||0;
    const actives=SKILLS.filter(s=>s.kind==='active');
    this.panel.innerHTML=`<section role="dialog" aria-label="御靈師技能樹" style="width:min(780px,97vw);max-height:90vh;overflow:auto;background:linear-gradient(145deg,#284b68,#102438);border:2px solid #d9bd85;border-radius:13px;padding:18px;box-sizing:border-box;box-shadow:0 15px 60px #000b"><header style="display:flex;justify-content:space-between;align-items:center"><div><strong style="color:#ffdf9b;font-size:22px">✦ 御靈師技能樹</strong><p style="font-size:13px;color:#bcd8e9">Lv.${lv} · ${['初心者','一轉','二轉','三轉','四轉','五轉'][rank]} · 可用 SP ${sp} · <span data-sk-live-mp>MP ${Math.floor(this.mp)}/${this.maxMp}</span></p></div><button data-sk-close style="padding:8px 12px;background:#39536c;color:white;border:1px solid #9caebe;border-radius:7px;cursor:pointer">關閉 ×</button></header>${[0,1,2,3,4,5].map(stage=>{const group=SKILLS.filter(s=>(s.stage||0)===stage);return `<div style="font-weight:bold;color:#ffe3a9;margin-top:18px;border-bottom:1px solid #6782a3;padding-bottom:8px">${['初心者','一轉 · Lv.10','二轉 · Lv.30','三轉 · Lv.60','四轉 · Lv.100','五轉 · Lv.150'][stage]} ${rank<stage?'🔒 未完成轉職':''}</div>${group.map(s=>{const r=this.rank(s.id),locked=lv<s.level||rank<stage,slot=actives.findIndex(a=>a.id===s.id)+1;return `<div style="padding:10px 0;border-bottom:1px solid #45607b;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b style="color:${locked?'#8ba0b0':'#ffe3a9'}">${elEscape(s.name)} · ${s.kind==='active'?'◆ 主動':'◇ 被動'}</b><div style="font-size:12px;color:#c1d8e7;margin:4px 0">${elEscape(s.desc)}</div><div style="font-size:12px">需要 Lv.${s.level}／${stage} 轉 · 技能 Lv.${r}/${s.max}${s.kind==='active'?' · MP '+s.mp+' · CD '+(s.cd/1000).toFixed(1)+'秒 · 快捷鍵 '+slot:''}</div></div><button data-sk-learn="${s.id}" ${locked||sp<=0||r>=s.max?'disabled':''} style="padding:8px;background:${locked?'#48566b':'#3e6885'};color:white;border:1px solid #a9bbcb;border-radius:6px;cursor:pointer">${locked?'尚未解鎖':r>=s.max?'已滿級':'提升 +1'}</button>${s.kind==='active'?`<button data-sk-cast="${s.id}" ${locked||r===0?'disabled':''} style="padding:8px;background:#567449;color:white;border:1px solid #a9bf8b;border-radius:6px;cursor:pointer">施放</button>`:''}</div>`}).join('')}`}).join('')}<button data-sk-advance style="padding:9px;margin-top:14px;background:#7a5735;color:#fff;border:1px solid #d5b47b;border-radius:7px;cursor:pointer">前往轉職聖殿</button><p style="font-size:12px;color:#bfd2de;line-height:1.6;margin-top:12px">S 開技能樹；T 開轉職聖殿。通過木樁試煉並完成轉職後，才可學習該階段技能。既有技能等級、SP 與人物外觀不變。</p></section>`;
  }
  destroy(){const s=this.scene;for(const [action,fn] of this.skillActions)s.keybinds.unregister(action,fn);s.events.off('update',this.onUpdate);window.removeEventListener('shenchong:character-created',this.onCharacter);this.panel.remove();this.hud.remove();}
}
