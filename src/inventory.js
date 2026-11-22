// 神寵 Alpha 0.8.4 — 裝備整合，保留 Alpha 0.7.1 物品/飼料機制
import { EQUIPMENT_DEFS, isEquipment } from './equipment.js'
// 神寵 Alpha 0.7.1：48格背包。食物/蛋仍由 petSave 作為唯一權威來源。
const KEY = 'shenchong_inventory_slots_v2'
const LEGACY = 'shenchong_inventory_layout_v1'
const MAX_SLOTS = 48
const MAX_STACK = 999
const ART = '/assets/items/'
const CATALOG = {
  food_basic: {name:'普通獸糧',cat:'consume',desc:'增加寵物 5 點飽食度。',food:'basic'},
  food_fresh: {name:'鮮肉',cat:'consume',desc:'增加寵物 10 點飽食度。',food:'fresh'},
  food_fruit: {name:'靈果',cat:'consume',desc:'增加寵物 20 點飽食度。',food:'fruit'},
  pet_egg: {name:'神秘寵物蛋',cat:'pet',desc:'可孵化隨機寵物。不可丟棄。',egg:true,max:1},
  material_crystal: {name:'魔力結晶（測試）',cat:'material',desc:'測試材料，尚未開放正式取得途徑。'},
  material_leaf: {name:'晨曦草（測試）',cat:'material',desc:'測試材料，尚未開放正式取得途徑。'},
  ...EQUIPMENT_DEFS
}
const TABS = [['all','全部'],['consume','消耗'],['material','材料'],['equip','裝備'],['quest','任務'],['pet','寵物']]
const clamp = n => Math.max(0,Math.min(9999,Math.floor(Number(n)||0)))
const valid = s => s && CATALOG[s.id] && Number.isInteger(s.qty) && s.qty>0 && s.qty <= (CATALOG[s.id].max||MAX_STACK)
export class InventoryUI {
  constructor(scene){
    this.scene=scene; this.open=false;this.category='all';this.selected=-1
    this.slots=Array(MAX_SLOTS).fill(null);this.locked=new Set();this.dragged=-1
    this.read();this.syncExternal();this.initDOM();this.refresh()
  }
  read(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'null')
      if(data && Array.isArray(data.slots)){
        this.slots=data.slots.slice(0,MAX_SLOTS).map(s=>valid(s)?{id:s.id,qty:s.qty}:null)
        while(this.slots.length<MAX_SLOTS)this.slots.push(null)
        this.locked=new Set((data.locked||[]).filter(x=>Number.isInteger(x)&&x>=0&&x<MAX_SLOTS))
        return
      }
      // 遷移 Alpha 0.7.0 存檔：只搬測試材料與布局；飼料、蛋改從 petSave 重新讀取。
      const old=JSON.parse(localStorage.getItem(LEGACY)||'null')
      if(old && Array.isArray(old.slots)){
        old.slots.slice(0,MAX_SLOTS).forEach((id,i)=>{
          if(!CATALOG[id])return
          const item=CATALOG[id]
          if(item.food||item.egg)return
          const qty=clamp(old.amounts?.[id])
          if(qty)this.slots[i]={id,qty:Math.min(qty,item.max||MAX_STACK)}
        })
      }
    }catch(err){console.warn('背包讀取失敗：使用安全預設值',err)}
  }
  save(){
    try{localStorage.setItem(KEY,JSON.stringify({slots:this.slots,locked:[...this.locked]}))}
    catch(err){console.warn('背包保存失敗',err)}
  }
  total(id){return this.slots.reduce((sum,s)=>sum+(s?.id===id?s.qty:0),0)}
  sourceTotal(id){
    const info=CATALOG[id]
    if(info.food)return clamp(this.scene.petSave?.food?.[info.food])
    if(info.egg)return this.scene.petSave?.egg && !this.scene.petSave?.pet?1:0
    return this.total(id)
  }
  syncExternal(){
    // 數量由既有寵物存檔決定，背包只改動每格分配比例。
    for(const [id,item] of Object.entries(CATALOG)){
      if(!item.food&&!item.egg)continue
      const target=this.sourceTotal(id), max=item.max||MAX_STACK
      let diff=target-this.total(id)
      if(diff<0){
        for(let i=MAX_SLOTS-1;i>=0&&diff<0;i--){
          const s=this.slots[i];if(s?.id!==id)continue
          const take=Math.min(s.qty,-diff);s.qty-=take;diff+=take
          if(!s.qty){this.slots[i]=null;this.locked.delete(i)}
        }
      }else if(diff>0){
        for(let i=0;i<MAX_SLOTS&&diff>0;i++){
          const s=this.slots[i];if(s?.id!==id||s.qty>=max)continue
          const n=Math.min(diff,max-s.qty);s.qty+=n;diff-=n
        }
        while(diff>0){
          const idx=this.slots.indexOf(null)
          if(idx<0){console.warn('背包空間不足，外部道具暫未顯示',id,diff);break}
          const n=Math.min(diff,max);this.slots[idx]={id,qty:n};diff-=n
        }
      }
    }
  }
  notice(txt){this.scene.showNotice?.(txt)}
  addItem(id,amount){
    const item=CATALOG[id];if(!item || item.food||item.egg)return false
    const qty=clamp(amount);if(!qty)return false
    const max=item.max||MAX_STACK
    const capacity=this.slots.reduce((sum,s)=>sum+(!s?max:s.id===id?max-s.qty:0),0)
    if(capacity<qty)return false
    let remaining=qty
    for(const s of this.slots){if(s?.id===id&&s.qty<max){const n=Math.min(remaining,max-s.qty);s.qty+=n;remaining-=n;if(!remaining)break}}
    while(remaining){let i=this.slots.indexOf(null);const n=Math.min(remaining,max);this.slots[i]={id,qty:n};remaining-=n}
    this.save();this.refresh();return true
  }
  move(from,to){
    if(from===to || !this.validIndex(from)||!this.validIndex(to) || !this.slots[from])return
    if(this.locked.has(from)||this.locked.has(to)){this.notice('請先解除格子鎖定');return}
    const a=this.slots[from],b=this.slots[to], max=CATALOG[a.id].max||MAX_STACK
    if(b?.id===a.id && b.qty<max){const n=Math.min(a.qty,max-b.qty);b.qty+=n;a.qty-=n;if(!a.qty)this.slots[from]=null}
    else [this.slots[from],this.slots[to]]=[b,a]
    this.selected=to;this.save();this.refresh()
  }
  validIndex(n){return Number.isInteger(n)&&n>=0&&n<MAX_SLOTS}
  sort(){
    const order={consume:0,material:1,equip:2,quest:3,pet:4}
    const unlocked=this.slots.map((s,i)=>!this.locked.has(i)?s:null).filter(Boolean)
    unlocked.sort((a,b)=>(order[CATALOG[a.id].cat]-order[CATALOG[b.id].cat])||a.id.localeCompare(b.id))
    for(let i=0;i<MAX_SLOTS;i++)if(!this.locked.has(i))this.slots[i]=unlocked.shift()||null
    this.selected=-1;this.save();this.refresh();this.notice('已整理未鎖定的背包格子')
  }
  selectedSlot(){return this.validIndex(this.selected)?this.slots[this.selected]:null}
  split(){
    const index=this.selected,source=this.selectedSlot()
    if(!source||source.qty<2){this.notice('至少需要兩個才能拆分');return}
    if(this.locked.has(index)){this.notice('請先解除鎖定');return}
    const free=this.slots.findIndex((s,i)=>!s&&!this.locked.has(i))
    if(free<0){this.notice('沒有空格可以拆分');return}
    const suggested=Math.floor(source.qty/2)
    const input=window.prompt(`要從「${CATALOG[source.id].name} ×${source.qty}」拆出多少？`,String(suggested))
    if(input===null)return
    if(!/^\d+$/.test(input.trim())){this.notice('請輸入正整數');return}
    const qty=Number(input)
    if(!Number.isSafeInteger(qty)||qty<=0||qty>=source.qty){this.notice('數量必須大於零且少於原堆疊');return}
    source.qty-=qty;this.slots[free]={id:source.id,qty};this.selected=free
    this.save();this.refresh()
  }
  lock(){
    if(!this.selectedSlot())return
    if(this.locked.has(this.selected))this.locked.delete(this.selected);else this.locked.add(this.selected)
    this.save();this.refresh()
  }
  discard(){
    const index=this.selected,s=this.selectedSlot();if(!s)return
    if(this.locked.has(index)){this.notice('請先解除鎖定');return}
    if(CATALOG[s.id].egg){this.notice('新手寵物蛋不可丟棄');return}
    const answer=window.prompt(`確定要丟棄「${CATALOG[s.id].name} ×${s.qty}」嗎？\n請輸入丟棄數量（按取消可返回）。`,String(s.qty))
    if(answer===null)return
    if(!/^\d+$/.test(answer.trim())){this.notice('請輸入正整數');return}
    const amount=Number(answer)
    if(!Number.isSafeInteger(amount)||amount<=0||amount>s.qty){this.notice('丟棄數量不正確');return}
    if(!window.confirm(`最後確認：永久丟棄 ${CATALOG[s.id].name} ×${amount}？`))return
    if(CATALOG[s.id].food){
      const food=CATALOG[s.id].food
      if(this.scene.petSave.food[food]<amount){this.notice('道具數量已改變，請重試');this.refresh();return}
      this.scene.petSave.food[food]-=amount
      this.scene.savePet();this.scene.refreshFeedingPanel()
    }
    s.qty-=amount
    if(!s.qty){this.slots[index]=null;this.locked.delete(index);this.selected=-1}
    this.save();this.refresh();this.notice(`已丟棄 ${CATALOG[s.id].name} ×${amount}`)
  }
  use(){
    const s=this.selectedSlot();if(!s)return
    const item=CATALOG[s.id]
    if(item.food)this.scene.feedPet(item.food)
    else if(item.egg)this.scene.hatchEgg()
    else if(isEquipment(s.id)) this.scene.equipment?.tryEquipFromInventory(this.selected)
    else this.notice('這項道具目前尚未開放使用')
    this.refresh()
  }
  toggle(force){
    this.open=typeof force==='boolean'?force:!this.open
    this.el.style.display=this.open?'block':'none'
    if(this.open){if(this.scene.feedingOpen)this.scene.toggleFeedingPanel(false);this.scene.player?.setVelocityX(0);this.refresh()}
  }
  initDOM(){
    const style=document.createElement('style');style.textContent=`
      #sc-inv{position:fixed;z-index:9999;left:calc(50% - 245px);top:8%;width:490px;max-height:87vh;display:none;color:#f5e8c9;font:14px 'Microsoft JhengHei',sans-serif;user-select:none;filter:drop-shadow(0 18px 30px #071222b8)}
      #sc-inv *{box-sizing:border-box}#sc-inv .frame{background:linear-gradient(145deg,#244c70 0%,#102840 55%,#0e2235 100%);border:3px solid #d6b780;border-radius:14px;box-shadow:inset 0 0 0 3px #375875,0 8px 22px #0008;padding:11px}
      #sc-inv .head{display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:20px;color:#ffe6ac;cursor:move;padding:3px 5px 9px}
      #sc-inv button{background:#365d80;color:#fff2d5;border:1px solid #86a6bd;border-radius:6px;padding:6px 9px;cursor:pointer;font:inherit}#sc-inv button:hover{background:#507a9b}#sc-inv button:disabled{opacity:.42;cursor:not-allowed}
      #sc-inv .tabs,#sc-inv .actions{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0}#sc-inv .tabs button{font-size:12px;padding:5px 9px}#sc-inv .tabs .active{background:#98713c;border-color:#ffe1a0}
      #sc-inv .slots{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}#sc-inv .slot{position:relative;min-width:0;aspect-ratio:1;border-radius:6px;border:1px solid #6887a3;background:linear-gradient(150deg,#284866,#162c46);cursor:pointer;display:flex;align-items:center;justify-content:center}
      #sc-inv .slot:hover{border-color:#ffe1a0}#sc-inv .slot.selected{border:2px solid #ffda71;background:#446384}#sc-inv .slot.over{outline:2px solid #8de3c1}
      #sc-inv .slot img{width:88%;height:88%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 3px #0007)}#sc-inv .quantity{position:absolute;right:2px;bottom:1px;font-size:11px;color:white;text-shadow:1px 1px 3px black}
      #sc-inv .lockmark{position:absolute;top:0;right:2px;color:#ffd17c;font-size:12px}#sc-inv .detail{min-height:73px;margin-top:9px;padding:9px;background:#142d46;border:1px solid #6e8da5;border-radius:8px;white-space:pre-line;line-height:1.5}
      #sc-inv .footer{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#bad1e0}#sc-inv .head, #sc-inv .slot{touch-action:none}
      #sc-inv .actions button{font-size:12px}#sc-inv .btn-red{background:#794a50;border-color:#bb8990}
      `;document.head.appendChild(style)
    const root=document.createElement('div');root.id='sc-inv'
    root.innerHTML=`<div class="frame"><div class="head"><span>✦ 神寵 · 冒險背包</span><button data-action="close">✕</button></div><div class="tabs"></div><div class="slots"></div><div class="detail"></div><div class="actions"><button data-action="use">使用／穿戴</button><button data-action="split">拆分</button><button data-action="lock">鎖定／解鎖</button><button data-action="sort">整理</button><button data-action="discard" class="btn-red">丟棄</button><button data-action="demo">測試材料 +3/+2</button></div><div class="footer"><span class="used"></span><span>按 I 關閉 · 拖曳交換 / 合併</span></div></div>`
    document.body.appendChild(root);this.el=root;this.grid=root.querySelector('.slots');this.details=root.querySelector('.detail');this.tabs=root.querySelector('.tabs')
    const click=(name,fn)=>root.querySelector(`[data-action="${name}"]`).addEventListener('click',fn)
    click('close',()=>this.toggle(false));click('use',()=>this.use());click('split',()=>this.split());click('lock',()=>this.lock());click('sort',()=>this.sort());click('discard',()=>this.discard())
    click('demo',()=>{
      const before=this.slots.map(s=>s?{...s}:null)
      if(this.addItem('material_crystal',3)&&this.addItem('material_leaf',2))this.notice('已取得測試材料')
      else {this.slots=before;this.save();this.refresh();this.notice('背包空間不足，沒有發放測試材料')}
    })
    const header=root.querySelector('.head');header.addEventListener('pointerdown',e=>{
      if(e.target.closest('button'))return
      const b=root.getBoundingClientRect(),dx=e.clientX-b.left,dy=e.clientY-b.top;header.setPointerCapture(e.pointerId)
      const move=ev=>{root.style.left=Math.max(0,Math.min(window.innerWidth-b.width,ev.clientX-dx))+'px';root.style.top=Math.max(0,Math.min(window.innerHeight-b.height,ev.clientY-dy))+'px'}
      const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end)}
      header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end)
    })
    for(const [id,label] of TABS){const b=document.createElement('button');b.textContent=label;b.dataset.tab=id;b.addEventListener('click',()=>{this.category=id;this.selected=-1;this.refresh()});this.tabs.appendChild(b)}
  }
  refresh(){
    if(!this.el)return
    this.syncExternal();this.save()
    this.tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===this.category))
    this.grid.replaceChildren()
    const indices=this.category==='all'?[...Array(MAX_SLOTS).keys()]:this.slots.map((s,i)=>s&&CATALOG[s.id].cat===this.category?i:-1).filter(i=>i>=0)
    const view=this.category==='all'?indices:[...indices,...Array(MAX_SLOTS-indices.length).fill(-1)]
    for(const idx of view){
      const s=idx>=0?this.slots[idx]:null,cell=document.createElement('div')
      cell.className='slot'+(idx===this.selected&&s?' selected':'');cell.title=s?CATALOG[s.id].name:''
      if(s){const img=document.createElement('img');img.src=ART+s.id+'.png';img.alt=CATALOG[s.id].name;img.draggable=false;cell.appendChild(img)
        const n=document.createElement('span');n.className='quantity';n.textContent=s.qty;cell.appendChild(n)
        if(this.locked.has(idx)){const lock=document.createElement('span');lock.className='lockmark';lock.textContent='🔒';cell.appendChild(lock)}
      }
      cell.addEventListener('click',()=>{this.selected=s?idx:-1;this.refresh()})
      cell.addEventListener('dblclick',()=>{this.selected=idx;this.use()})
      if(this.category==='all'){
        cell.draggable=!!s
        cell.addEventListener('dragstart',e=>{if(!s){e.preventDefault();return}this.dragged=idx;e.dataTransfer.setData('text/plain',String(idx))})
        cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('over')})
        cell.addEventListener('dragleave',()=>cell.classList.remove('over'))
        cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('over');this.move(Number(e.dataTransfer.getData('text/plain')),idx)})
      }
      this.grid.appendChild(cell)
    }
    const s=this.selectedSlot()
    this.details.textContent=s?`${CATALOG[s.id].name} ×${s.qty}${this.locked.has(this.selected)?'  [已鎖定]':''}\n${CATALOG[s.id].desc}`:'點選物品查看資訊；拖曳至同類物品合併、拖曳至空格或異類物品移動／交換。'
    for(const action of ['use','split','lock','discard'])this.el.querySelector(`[data-action="${action}"]`).disabled=!s || (action==='discard' && !!CATALOG[s.id]?.egg) || (action==='split' && s.qty<2)
    this.el.querySelector('.used').textContent=`已使用 ${this.slots.filter(Boolean).length} / ${MAX_SLOTS} 格`
  }
}
