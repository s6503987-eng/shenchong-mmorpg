import Phaser from 'phaser'
// 《神寵》Alpha 0.8.9.2 — 正式裝備 ID 與御靈師圖層同步修正
// 裝備與背包是同一份物品：穿戴時從背包移除，卸下時回到背包。
import { readCharacter } from './character.js'
export const EQUIPMENT_DEFS = {
  equip_head:    {name:'晨星頭飾',cat:'equip',slot:'head',desc:'裝飾性頭飾（目前不提供能力值）。',max:1},
  equip_armor:   {name:'見習冒險服',cat:'equip',slot:'body',desc:'基礎冒險者服裝（目前不提供能力值）。',max:1},
  equip_cape:    {name:'晨曦披風',cat:'equip',slot:'cape',desc:'輕盈的冒險披風（目前不提供能力值）。',max:1},
  equip_sword:   {name:'見習騎士劍',cat:'equip',slot:'weapon',job:'warrior',desc:'戰士專屬裝備。戰鬥尚未開放。',max:1},
  equip_staff:   {name:'星晶法杖',cat:'equip',slot:'weapon',job:'mage',desc:'法師專屬裝備。戰鬥尚未開放。',max:1},
  equip_bow:     {name:'晨風短弓',cat:'equip',slot:'weapon',job:'archer',desc:'弓箭手專屬裝備。戰鬥尚未開放。',max:1},
  equip_orb:     {name:'神寵共鳴珠',cat:'equip',slot:'weapon',job:'spirit',desc:'御靈師專屬裝備。融合尚未開放。',max:1},
  // Alpha 0.8.9.1：四職業 16 件正式裝備（保留舊裝備 ID 與存檔）
  warrior_head: {name:'蒼鋼戰冠',cat:'equip',slot:'head',job:'warrior',desc:'開放式銀藍冠盔、金色前額護片。目前無戰鬥屬性。',max:1},
  warrior_outfit: {name:'蒼鋼守衛鎧',cat:'equip',slot:'body',job:'warrior',desc:'藍銀甲片、黃金護肩與胸甲。目前無戰鬥屬性。',max:1},
  warrior_cape: {name:'守誓披風',cat:'equip',slot:'cape',job:'warrior',desc:'青藍飄動披風、守護紋章。目前無戰鬥屬性。',max:1},
  warrior_weapon: {name:'晨鋒長劍',cat:'equip',slot:'weapon',job:'warrior',desc:'長直銀色劍刃、藍晶護手。目前無戰鬥屬性。',max:1},
  mage_head: {name:'星淵法帽',cat:'equip',slot:'head',job:'mage',desc:'紫羅蘭法帽、星晶帽帶。目前無戰鬥屬性。',max:1},
  mage_outfit: {name:'星紋秘術袍',cat:'equip',slot:'body',job:'mage',desc:'紫藍長袍、金色星軌紋。目前無戰鬥屬性。',max:1},
  mage_cape: {name:'暮星斗篷',cat:'equip',slot:'cape',job:'mage',desc:'暮紫短斗篷、流光刺繡。目前無戰鬥屬性。',max:1},
  mage_weapon: {name:'秘晶法杖',cat:'equip',slot:'weapon',job:'mage',desc:'紫晶杖頭、金色環形杖身。目前無戰鬥屬性。',max:1},
  archer_head: {name:'翠羽兜帽',cat:'equip',slot:'head',job:'archer',desc:'森林綠兜帽、白羽與黃金飾片。目前無戰鬥屬性。',max:1},
  archer_outfit: {name:'疾風獵裝',cat:'equip',slot:'body',job:'archer',desc:'綠色輕甲、皮革肩甲束腕。目前無戰鬥屬性。',max:1},
  archer_cape: {name:'森語短披',cat:'equip',slot:'cape',job:'archer',desc:'草綠短披風、葉形下擺。目前無戰鬥屬性。',max:1},
  archer_weapon: {name:'風吟長弓',cat:'equip',slot:'weapon',job:'archer',desc:'金綠反曲長弓、葉片弓臂。目前無戰鬥屬性。',max:1},
  spirit_head: {name:'星輝靈冠',cat:'equip',slot:'head',job:'spirit',desc:'金色靈冠、中央晶藍寶石。目前無戰鬥屬性。',max:1},
  spirit_outfit: {name:'共鳴法衣',cat:'equip',slot:'body',job:'spirit',desc:'白藍法衣、金邊與寵物徽紋。目前無戰鬥屬性。',max:1},
  spirit_cape: {name:'靈光披風',cat:'equip',slot:'cape',job:'spirit',desc:'深藍披風、白金衣襬與垂墜飾。目前無戰鬥屬性。',max:1},
  spirit_weapon: {name:'神寵共鳴珠',cat:'equip',slot:'weapon',job:'spirit',desc:'晶藍浮空靈珠、金色星環。目前無戰鬥屬性。',max:1}
}
const SAVE='shenchong_equipment_v1', GIFT='shenchong_equipment_starter_v1'
const SLOTS=[['head','頭飾'],['body','服裝'],['cape','披風'],['weapon','武器']]
const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k)
export function isEquipment(id){return own(EQUIPMENT_DEFS,id)}
export class EquipmentUI {
  constructor(scene){
    this.scene=scene;this.open=false;this.gear={head:null,body:null,cape:null,weapon:null};this.load()
    this.visual=scene.add.graphics().setDepth(29)
    document.getElementById('sc-equipment')?.remove()
    this.initDOM();this.update()
    scene.events.once('shutdown',()=>{this.visual.destroy();this.el?.remove()})
  }
  load(){try {const d=JSON.parse(localStorage.getItem(SAVE)||'null'); if(!d||!d.gear)return;
    for(const [k] of SLOTS){const id=d.gear[k];if(id && EQUIPMENT_DEFS[id]?.slot===k)this.gear[k]=id}
  }catch(err){console.warn('裝備存檔讀取失敗',err)}}
  save(){try{localStorage.setItem(SAVE,JSON.stringify({version:1,gear:this.gear}))}catch(err){this.notice('裝備保存失敗：請檢查瀏覽器儲存空間');console.warn(err)}}
  notice(message){this.scene.showNotice?.(message)}
  job(){return readCharacter()?.jobId||null}
  // 原子式處理單次交易；拒絕已鎖定道具、跨職業裝備或背包滿載。
  tryEquipFromInventory(index){
    const inv=this.scene.inventory,source=inv?.slots?.[index]
    if(!source||!isEquipment(source.id))return false
    if(inv.locked.has(index)){this.notice('裝備已鎖定，請先解除');return false}
    const def=EQUIPMENT_DEFS[source.id]
    if(def.job && def.job!==this.job()){this.notice(`只能由「${({warrior:'戰士',mage:'法師',archer:'弓箭手',spirit:'御靈師'})[def.job]}」穿戴`);return false}
    const previous=this.gear[def.slot]
    // 若原裝備存在，直接放回取出的背包格，避免裝備交換造成背包溢出。
    if(previous){inv.slots[index]={id:previous,qty:1}}
    else {source.qty--;if(!source.qty)inv.slots[index]=null}
    this.gear[def.slot]=source.id
    inv.selected=-1;inv.save();this.save();inv.refresh();this.render();this.update()
    this.notice(`已穿戴：${def.name}`);return true
  }
  unequip(slot){
    const id=this.gear[slot],inv=this.scene.inventory
    if(!id||!inv)return false
    // 先查背包空位，確認可以卸下才更改存檔。
    const idx=inv.slots.findIndex((s,i)=>!s&&!inv.locked.has(i))
    if(idx<0){this.notice('背包已滿，無法卸下裝備');return false}
    inv.slots[idx]={id,qty:1};this.gear[slot]=null
    inv.save();this.save();inv.refresh();this.render();this.update();this.notice(`已卸下：${EQUIPMENT_DEFS[id].name}`);return true
  }
  gift(){
    if(localStorage.getItem(GIFT)==='claimed'){this.notice('測試裝備組已領取');return}
    const inv=this.scene.inventory;if(!inv){this.notice('背包尚未初始化');return}
    const ids=['equip_head','equip_armor','equip_cape','equip_sword','equip_staff','equip_bow','equip_orb']
    const free=inv.slots.map((s,i)=>!s&&!inv.locked.has(i)?i:-1).filter(i=>i>=0)
    if(free.length<ids.length){this.notice('請先留出至少 7 個背包空格');return}
    ids.forEach((id,n)=>inv.slots[free[n]]={id,qty:1})
    inv.save();inv.refresh();try{localStorage.setItem(GIFT,'claimed')}catch(err){console.warn('測試獎勵標記無法儲存',err)}
    this.notice('已領取七件測試裝備（每個存檔一次）');this.render()
  }
  giftCurrentJob(){
    const job=this.job()
    if(!['warrior','mage','archer','spirit'].includes(job)){this.notice('請先建立角色並選擇職業');return}
    const mark=`shenchong_alpha0891_gift_${job}_v1`
    if(localStorage.getItem(mark)==='claimed'){this.notice('本職業的正式裝備已領取過');return}
    const inv=this.scene.inventory
    if(!inv){this.notice('背包尚未初始化');return}
    const ids=[`${job}_head`,`${job}_outfit`,`${job}_cape`,`${job}_weapon`]
    const free=inv.slots.map((s,i)=>!s&&!inv.locked.has(i)?i:-1).filter(i=>i>=0)
    if(free.length<4){this.notice('領取需要四個未鎖定的背包空格');return}
    ids.forEach((id,i)=>{inv.slots[free[i]]={id,qty:1}})
    inv.save();inv.refresh()
    try{localStorage.setItem(mark,'claimed')}catch(err){console.warn('裝備領取標記儲存失敗',err)}
    this.render();this.notice('已領取本職業四件正式裝備；可在背包穿戴')
  }
  toggle(force){
    this.open=typeof force==='boolean'?force:!this.open
    if(this.el)this.el.style.display=this.open?'flex':'none'
    if(this.open){this.scene.player?.setVelocityX(0);this.render()}
  }
  initDOM(){
    document.getElementById('sc-eq-css')?.remove()
    const style=document.createElement('style');style.id='sc-eq-css';style.textContent=`
#sc-equipment{position:fixed;z-index:10002;top:8%;right:4%;width:min(690px,95vw);max-height:84vh;display:none;flex-direction:column;color:#f9eacc;font:14px 'Microsoft JhengHei',sans-serif;background:linear-gradient(145deg,#2a4869,#101f34);border:2px solid #dbb977;border-radius:16px;box-shadow:0 22px 52px #070e1dcf;overflow:hidden}
#sc-equipment *{box-sizing:border-box}#sc-equipment button{color:#ffefce;font:inherit;cursor:pointer;border:1px solid #8ba6c1;background:#315372;border-radius:7px;padding:7px 9px}#sc-equipment button:hover{background:#48749a}#sc-equipment button:disabled{opacity:.4;cursor:not-allowed}
#sc-equipment .eq-head{padding:12px 14px;background:linear-gradient(90deg,#253f62,#182a44);border-bottom:1px solid #977e57;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none}
#sc-equipment .eq-title{font-size:19px;font-weight:700;color:#ffdf9f;letter-spacing:1px}#sc-equipment .eq-main{padding:12px;overflow-y:auto}#sc-equipment .eq-tabs{display:flex;gap:5px;margin-bottom:10px}#sc-equipment .eq-tabs button.active{background:#af8851;border-color:#f4d99b;color:#19253d}
#sc-equipment .eq-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}#sc-equipment .eq-preview{background:radial-gradient(ellipse at center,#426b90 0%,#213a5c 55%,#162842 100%);border:1px solid #7699b6;border-radius:11px;padding:10px;display:flex;flex-direction:column;align-items:center}
#sc-equipment .eq-doll{position:relative;width:155px;height:193px;overflow:visible;margin:5px 0}#sc-equipment .eq-doll img{position:absolute;inset:0;width:155px;height:193px;object-fit:fill;image-rendering:auto;pointer-events:none}#sc-equipment .eq-doll img.sc094-full-preview{left:-19px;top:2px;width:193px;height:187px;object-fit:contain}#sc-equipment .eq-doll img.layer{z-index:2}#sc-equipment .eq-doll img.back{z-index:0}#sc-equipment .eq-doll img.body{z-index:1}#sc-equipment .eq-doll img.front{z-index:4}
#sc-equipment .eq-slots{display:grid;gap:7px}#sc-equipment .eq-slot{background:#233d58;border:1px solid #6786a4;border-radius:9px;display:flex;align-items:center;gap:8px;padding:8px;min-height:68px}#sc-equipment .eq-slot.selected,#sc-equipment .eq-slot.dragover{border-color:#ffdb88;box-shadow:inset 0 0 0 1px #ffdb88}#sc-equipment .eq-icon{width:48px;height:48px;border:1px solid #678ba7;border-radius:7px;background:linear-gradient(145deg,#2f5675,#142b43);display:grid;place-items:center;flex-shrink:0}#sc-equipment .eq-icon img{width:43px;height:43px;object-fit:contain}#sc-equipment .eq-slotname{font-size:12px;color:#b8d0e6}#sc-equipment .eq-itemname{font-size:13px;color:#ffdf9d;overflow-wrap:anywhere}#sc-equipment .eq-slot-info{min-width:0;flex:1}#sc-equipment .eq-slot button{font-size:12px;padding:5px 7px}
#sc-equipment .eq-bottom{margin-top:10px;border:1px solid #6686a4;background:#1c344e;border-radius:9px;padding:10px;min-height:69px;display:flex;align-items:center;justify-content:space-between;gap:8px}#sc-equipment .eq-note{font-size:12px;color:#c0d2e3;line-height:1.65;margin-top:9px}#sc-equipment .eq-small{font-size:12px;color:#c6d6e6}#sc-equipment .eq-gift{margin-top:10px;width:100%}#sc-equipment .eq-disabled-note{padding:24px 8px;text-align:center;color:#c7d8e9;line-height:1.8}
@media(max-width:570px){#sc-equipment{top:4%;right:2%;max-height:91vh;width:96vw}#sc-equipment .eq-columns{grid-template-columns:1fr}#sc-equipment .eq-preview{padding:5px}#sc-equipment .eq-doll{height:140px;width:112px}#sc-equipment .eq-doll img{width:112px;height:140px}}
`;document.head.appendChild(style)
    const el=document.createElement('section');el.id='sc-equipment';el.setAttribute('aria-label','神寵裝備欄')
    el.innerHTML=`<div class="eq-head"><div class="eq-title">✦ 神寵 · 紙娃娃裝備</div><button class="eq-close" aria-label="關閉裝備欄">×</button></div><div class="eq-main"><div class="eq-tabs"><button data-eqtab="equipment" class="active">裝備</button><button data-eqtab="fashion">外觀</button><button data-eqtab="fusion">神寵融合</button></div><div class="eq-content"></div><button class="eq-gift eq-formal-gift">領取本職業四件正式裝備</button><button class="eq-gift eq-old-gift">領取舊版測試裝備組</button><div class="eq-note">按 B 關閉；背包 I → 選擇裝備 → 使用／穿戴。也可在背包「全部」分頁拖曳裝備到右側裝備格。裝備資料沿用原存檔。戰鬥與融合尚未開放。</div></div>`
    document.body.appendChild(el);this.el=el;this.tab='equipment';this.selectedGearSlot='body'
    el.querySelector('.eq-close').addEventListener('click',()=>this.toggle(false))
    el.querySelector('.eq-formal-gift').addEventListener('click',()=>this.giftCurrentJob())
    el.querySelector('.eq-old-gift').addEventListener('click',()=>this.gift())
    el.querySelectorAll('[data-eqtab]').forEach(button=>button.addEventListener('click',()=>{this.tab=button.dataset.eqtab;this.render()}))
    const header=el.querySelector('.eq-head');header.addEventListener('pointerdown',event=>{
      if(event.target.closest('button'))return
      const bounds=el.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top
      header.setPointerCapture(event.pointerId)
      const move=e=>{el.style.right='auto';el.style.top=Math.max(0,Math.min(innerHeight-45,e.clientY-y))+'px';el.style.left=Math.max(0,Math.min(innerWidth-50,e.clientX-x))+'px'}
      const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end)}
      header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end)
    })
  }
  render(){
    if(!this.el)return
    this.el.querySelectorAll('[data-eqtab]').forEach(b=>b.classList.toggle('active',b.dataset.eqtab===this.tab))
    const container=this.el.querySelector('.eq-content');container.replaceChildren()
    if(this.tab!=='equipment'){
      const p=document.createElement('div');p.className='eq-disabled-note'
      p.textContent=this.tab==='fashion'?'外觀裝扮可按 V 開啟現有試衣間；正式時裝欄將於後續版本整合。':'神寵融合尚未開放。未來可預覽職業 × 神寵的變身形態。'
      container.appendChild(p);return
    }
    const chr=readCharacter(),job=chr?.jobId||'warrior'
    const names={warrior:'戰士',mage:'法師',archer:'弓箭手',spirit:'御靈師'}
    const columns=document.createElement('div');columns.className='eq-columns';container.appendChild(columns)
    const preview=document.createElement('div');preview.className='eq-preview';columns.appendChild(preview)
    const heading=document.createElement('div');heading.style.cssText='color:#ffdf9f;font-weight:700';heading.textContent=`${chr?.name||'冒險者'} · ${names[job]||'冒險者'}`;preview.appendChild(heading)
    const doll=document.createElement('div');doll.className='eq-doll';preview.appendChild(doll)
    const img=(src,cl)=>{const el=document.createElement('img');el.src=src;el.className=cl;el.alt='';el.onerror=()=>el.remove();doll.appendChild(el);return el}
    // Alpha 0.9.0: UI 預覽與地圖共用裝備 ID -> PNG 路徑。
    if(job==='spirit'){
      const art=(id)=>`/assets/paperdoll/spirit/${id}/idle0.png`
      if(['equip_cape','spirit_cape'].includes(this.gear.cape))img(art(this.gear.cape),'back layer')
      img(this.gear.body==='spirit_outfit'?'/assets/layers/spirit_v2/base_worn/idle0.png':'/assets/layers/spirit_v2/base/idle0.png','body')
      if(['equip_armor','spirit_outfit'].includes(this.gear.body))img(art(this.gear.body),'layer')
      if(['equip_head','spirit_head'].includes(this.gear.head))img(art(this.gear.head),'layer')
      if(['equip_orb','spirit_weapon'].includes(this.gear.weapon))img(art(this.gear.weapon),'front layer')
      if(this.gear.body==='spirit_outfit')img('/assets/paperdoll/spirit/foreground_hands/idle0.png','front layer')
    }else{img(`/assets/job_motion/${job}_idle0.png`,'body')}
    const previewInfo=document.createElement('div');previewInfo.className='eq-small';previewInfo.textContent='逐件紙娃娃預覽 · 待機影格';preview.appendChild(previewInfo)
    const slots=document.createElement('div');slots.className='eq-slots';columns.appendChild(slots)
    for(const [slot,label] of SLOTS){
      const id=this.gear[slot],def=id?EQUIPMENT_DEFS[id]:null
      const row=document.createElement('div');row.className='eq-slot'+(this.selectedGearSlot===slot?' selected':'');row.tabIndex=0;row.title=`${label}：${def?.name||'空'}`
      const icon=document.createElement('div');icon.className='eq-icon';if(id){const i=document.createElement('img');i.src=`/assets/items/${id}.png`;i.alt='';icon.appendChild(i)}else{icon.textContent=({head:'♛',body:'✥',cape:'◈',weapon:'✦'})[slot]}
      const body=document.createElement('div');body.className='eq-slot-info';const n=document.createElement('div');n.className='eq-slotname';n.textContent=label
      const t=document.createElement('div');t.className='eq-itemname';t.textContent=def?.name||'未穿戴';body.append(n,t)
      const btn=document.createElement('button');btn.textContent='卸下';btn.disabled=!id;btn.addEventListener('click',()=>this.unequip(slot))
      row.append(icon,body,btn);row.addEventListener('click',()=>{this.selectedGearSlot=slot;this.render()})
      row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('dragover')})
      row.addEventListener('dragleave',()=>row.classList.remove('dragover'))
      row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('dragover');const index=Number(e.dataTransfer?.getData('text/plain'));const inv=this.scene.inventory
        if(!inv||!Number.isInteger(index)||index<0||index>=inv.slots.length)return
        const def=EQUIPMENT_DEFS[inv.slots[index]?.id];if(!def||def.slot!==slot){this.notice('此裝備不屬於這個欄位');return}
        this.tryEquipFromInventory(index)
      })
      slots.appendChild(row)
    }
    const bottom=document.createElement('div');bottom.className='eq-bottom';container.appendChild(bottom)
    const id=this.gear[this.selectedGearSlot],def=id?EQUIPMENT_DEFS[id]:null
    const detail=document.createElement('div');detail.className='eq-small';detail.style.flex='1';detail.textContent=def?`${def.name}｜${def.desc}`:`${SLOTS.find(([s])=>s===this.selectedGearSlot)?.[1]}欄位尚未穿戴裝備。從背包拖曳對應道具，或選取後按「穿戴」。`;bottom.appendChild(detail)
    const equipSelected=document.createElement('button');equipSelected.textContent='穿戴背包選取物';equipSelected.addEventListener('click',()=>{
      const inv=this.scene.inventory,idx=inv?.selected,s=inv?.slots?.[idx];if(!s||EQUIPMENT_DEFS[s.id]?.slot!==this.selectedGearSlot){this.notice('請先在背包選取符合欄位的裝備');return}this.tryEquipFromInventory(idx)
    });bottom.appendChild(equipSelected)
  }
  update(){
    const g=this.visual,p=this.scene.player;if(!p)return
    g.clear().setPosition(p.x,p.y).setScale(p.flipX?-1:1,1)
    if(this.scene.activeJobId==='spirit')return // 以正式紙娃娃圖層渲染，停用幾何示意圖
    if(this.scene.activeJobId==='spirit')return // 真正分層外觀由 SpiritWardrobeV2 繪製，停用粗糙幾何圖案
    if(this.gear.cape){g.fillStyle(0x63bfec,.55).fillTriangle(-24,-24,-35,23,-19,18);g.lineStyle(2,0xf7d48d,.75).strokeLineShape(new Phaser.Geom.Line(-24,-23,-34,22))}
    if(this.gear.body){g.lineStyle(2,0xe4c586,.95).strokeRoundedRect(-13,-12,27,24,5);g.fillStyle(0x5bd6f6,.8).fillCircle(0,0,4)}
    if(this.gear.head){g.fillStyle(0xe9c66d,.95).fillTriangle(-12,-43,0,-57,12,-43);g.fillStyle(0x68daff,.95).fillCircle(0,-45,4)}
    if(this.gear.weapon){g.lineStyle(3,0xe7d197,.9).strokeLineShape(new Phaser.Geom.Line(22,-7,27,24));g.fillStyle(0x78daf6,.9).fillCircle(21,-13,6)}
  }
}

// SC_FIXED_SPIRIT_PREVIEW_2026: 在 B 裝備視窗固定顯示真正的地圖人物，與裝備 ID 無關。
const __scOldEquipmentRender = EquipmentUI.prototype.render;
EquipmentUI.prototype.render = function(...args) {
  const result=__scOldEquipmentRender.apply(this,args);
  const job=this.job?.() || this.scene?.activeJobId;
  if (job==='spirit' && this.tab==='equipment') {
    const doll=this.el?.querySelector('.eq-doll');
    if(doll){
      doll.replaceChildren();
      const picture=document.createElement('img');
      picture.src='/assets/job_motion/spirit_idle0.png';
      picture.alt='御靈師原始角色美術（固定外觀）';
      picture.className='body';
      picture.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:1';
      doll.appendChild(picture);
      doll.dataset.scFixedOriginal='yes';
    }
  }
  return result;
};
