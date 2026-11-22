// 《神寵》Alpha 0.8.1 — 四職業美術／角色資訊／未來神寵融合預覽
// 保留 Alpha 0.8.0 的 localStorage key，不修改玩家或寵物資料。
const STORAGE_KEY = 'shenchong_character_v1'
const PET_KEY = 'shenchong_alpha050_pet_v1'

export const JOBS = Object.freeze([
  {id:'warrior',name:'戰士',subtitle:'堅毅的守護者',emoji:'⚔️',desc:'以劍與護甲守護夥伴。未來偏重近距離與防禦。',attrs:{STR:12,DEX:6,INT:4,LUK:5},mp:40,color:'#ebc789',art:'/assets/jobs/warrior.png',fusion:['龍魂戰士','狐影劍士','冰牙戰士']},
  {id:'mage',name:'法師',subtitle:'元素的探索者',emoji:'✧',desc:'精通元素與魔法共鳴。未來偏重元素施法。',attrs:{STR:4,DEX:5,INT:12,LUK:6},mp:100,color:'#c6a8ff',art:'/assets/jobs/mage.png',fusion:['龍炎術師','幻焰術師','極霜法師']},
  {id:'archer',name:'弓箭手',subtitle:'敏捷的追風者',emoji:'🏹',desc:'擅長精準、敏捷與野外探索。',attrs:{STR:6,DEX:12,INT:4,LUK:5},mp:60,color:'#b2e4b6',art:'/assets/jobs/archer.png',fusion:['龍翼射手','靈狐獵手','霜影射手']},
  {id:'spirit',name:'御靈師',subtitle:'神寵的締約者',emoji:'✦',desc:'與神寵同心共鳴。未來偏重輔助與融合。',attrs:{STR:4,DEX:6,INT:9,LUK:8},mp:85,color:'#8bdff0',art:'/assets/jobs/spirit.png',fusion:['龍魂御使','九尾御使','冰狼御使']}
])
const getJob = id => JOBS.find(j=>j.id===id) || null
const validName = s => typeof s==='string' && /^[\p{L}\p{N}_\- ]{2,12}$/u.test(s.trim())

export function readCharacter() {
  try {
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')
    const job=getJob(raw?.jobId)
    if(!job)return null
    return {
      schemaVersion:1,
      displayName:validName(raw.displayName)?raw.displayName.trim():'新手冒險者',
      jobId:job.id,
      level:Math.max(1,Number.isFinite(Number(raw.level))?Math.floor(Number(raw.level)):1),
      exp:Math.max(0,Number(raw.exp)||0),
      attributes:{...job.attrs,...(raw.attributes||{})},
      hpMax:Math.max(1,Number(raw.hpMax)||100), mpMax:Math.max(1,Number(raw.mpMax)||job.mp),
      fusion:{unlocked:false,active:false,activePetId:null,durationMs:0,cooldownMs:0,...(raw.fusion||{}),active:false},
      createdAt:typeof raw.createdAt==='string'?raw.createdAt:new Date().toISOString()
    }
  } catch(e) {console.warn('角色資料讀取失敗',e);return null}
}
function saveCharacter(ch) {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(ch));return true}
  catch(e){console.error('角色存檔失敗',e);return false}
}
function petInfo() {
  try {
    const d=JSON.parse(localStorage.getItem(PET_KEY)||'null')
    const type=d?.pet?.type
    return {name:({dragon:'幼龍',fox:'靈狐',wolf:'霜狼'})[type]||'尚未孵化',type:type||null,rarity:d?.pet?.rarity||'—',hunger:Number(d?.pet?.hunger)||0}
  } catch {return {name:'尚未孵化',type:null,rarity:'—',hunger:0}}
}
const htmlSafe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const css=`
#sc-job-root{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(7,14,30,.76);backdrop-filter:blur(5px);box-sizing:border-box;font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif;color:#f5ecdb}
#sc-job-root.sc-visible{display:flex}#sc-job-root *{box-sizing:border-box}
#sc-job-root .window{width:min(1010px,96vw);max-height:91vh;overflow:auto;border:2px solid #c9ae75;border-radius:15px;background:linear-gradient(152deg,#294965 0%,#14283f 56%,#0e1c30 100%);box-shadow:0 24px 90px #050914b8,inset 0 1px #ffffff30;padding:21px}
#sc-job-root .head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:13px}
#sc-job-root h2{margin:0 0 5px;color:#ffe5a7;font-size:25px;letter-spacing:1px}
#sc-job-root .muted{color:#b9cee1;font-size:13px;line-height:1.65;margin:0}
#sc-job-root button{font-family:inherit;cursor:pointer}
#sc-job-root .small-btn{border:1px solid #8ea6bb;background:#315069;color:#fff;padding:8px 13px;border-radius:8px}
#sc-job-root .primary{border:1px solid #ffebac;background:linear-gradient(#f3d99c,#c49a5f);color:#1d2c3e;font-size:15px;font-weight:bold;border-radius:9px;padding:12px 20px}
#sc-job-root .choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}
#sc-job-root .job-card{border:1px solid #7191ae;background:linear-gradient(#365774,#233a54);border-radius:11px;color:#f9efe0;display:flex;flex-direction:column;align-items:center;padding:10px 8px 12px;min-width:0;transition:transform .12s,border-color .12s}
#sc-job-root .job-card:hover{transform:translateY(-3px);border-color:#f6d79d}
#sc-job-root .job-card.active{border:2px solid #f2cf79;box-shadow:0 0 0 2px #f5cf7030}
#sc-job-root .art-bg{width:100%;height:195px;display:flex;justify-content:center;align-items:flex-end;overflow:hidden;border-radius:8px;background:radial-gradient(ellipse at bottom,#91b4c568,transparent 72%)}
#sc-job-root .art-bg img{width:auto;height:100%;max-width:100%;object-fit:contain;filter:drop-shadow(0 5px 4px #07132299)}
#sc-job-root .job-card strong{font-size:18px;margin-top:7px}
#sc-job-root .job-card small{color:#b5cde1;margin-top:3px}
#sc-job-root .row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
#sc-job-root .footer{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #536d86;padding-top:15px}
#sc-job-root input{padding:10px 12px;border:1px solid #9cb4ca;border-radius:8px;background:#0e2339;color:#fff;font-size:15px;max-width:100%;width:205px}
#sc-job-root label{font-size:13px;color:#e1dac5;display:block;margin-bottom:6px}
#sc-job-root .stat-summary{background:#10283f;border:1px solid #54758b;border-radius:9px;padding:12px;line-height:1.8;flex:1;min-width:210px;font-size:13px}
#sc-job-root .error{color:#ffc0b0;font-size:13px;min-height:20px;margin-top:6px}
#sc-job-root .profile{display:grid;grid-template-columns:235px minmax(0,1fr);gap:16px}
#sc-job-root .portrait{border:1px solid #65849c;border-radius:12px;background:radial-gradient(ellipse at bottom,#617f9a99,#152d47 70%);padding:10px;min-height:290px;display:flex;align-items:center;justify-content:center}
#sc-job-root .portrait img{width:100%;height:280px;object-fit:contain;filter:drop-shadow(0 8px 5px #061323)}
#sc-job-root .tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
#sc-job-root .tab{border:1px solid #7894aa;color:#dce9f7;background:#27445d;border-radius:8px;padding:8px 13px}
#sc-job-root .tab.active{color:#1c2c41;background:#ead09a;border-color:#ffecbd;font-weight:bold}
#sc-job-root .panel{border:1px solid #54728b;border-radius:10px;background:#0f263f;padding:14px;min-height:212px}
#sc-job-root .stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}
#sc-job-root .stat{border:1px solid #4c6780;background:#19344f;border-radius:9px;padding:9px 12px}
#sc-job-root .stat b{color:#ffe5a7}
#sc-job-root .bar{height:8px;border-radius:8px;background:#1a3449;overflow:hidden;margin-top:5px}
#sc-job-root .bar span{display:block;height:100%;border-radius:8px}
#sc-job-root .muted-list{margin:6px 0;padding-left:20px;font-size:13px;color:#d7e2ec;line-height:1.9}
@media(max-width:720px){#sc-job-root .choices{grid-template-columns:repeat(2,minmax(0,1fr))}#sc-job-root .profile{grid-template-columns:1fr}#sc-job-root .portrait{min-height:190px}#sc-job-root .portrait img{height:180px}#sc-job-root .art-bg{height:155px}}
`

export class CharacterUI {
  constructor(scene){
    this.scene=scene
    this.character=readCharacter()
    this.selected='warrior'
    this.open=false
    this.tab='status'
    document.getElementById('sc-job-root')?.remove()
    if(!document.getElementById('sc-job-style')) {const el=document.createElement('style');el.id='sc-job-style';el.textContent=css;document.head.appendChild(el)}
    else document.getElementById('sc-job-style').textContent=css
    this.root=document.createElement('div');this.root.id='sc-job-root';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');document.body.appendChild(this.root)
    this.updateHud()
    if(!this.character)this.openChoice()
  }
  updateHud(){
    if(!this.character)return
    const job=getJob(this.character.jobId)
    this.scene.characterTitle?.setText(`Lv. ${this.character.level}  ${this.character.displayName} · ${job.name}`)
    this.scene.mpLabel?.setText(`MP   ${job.mp} / ${job.mp} (預留)`)
  }
  isBlocking(){return this.open}
  toggle(){if(this.open){if(this.character)this.close();return}this.character?this.openProfile():this.openChoice()}
  close(){if(!this.character)return;this.open=false;this.root.classList.remove('sc-visible');this.root.innerHTML=''}
  mount(markup){this.root.innerHTML=markup;this.root.classList.add('sc-visible');this.open=true}
  openChoice(){
    this.selected='warrior'
    this.mount(`<section class="window"><div class="head"><div><h2>✦ 神寵 · 四大職業</h2><p class="muted">選擇專屬職業與外觀；未來可與幼龍、靈狐及霜狼進行短時間融合。</p><p class="muted">本版選擇後無法轉職，職業資料存於目前瀏覽器。</p></div></div><div id="sc-job-list" class="choices"></div><div class="footer"><div><label for="sc-name">角色名稱（2–12 字）</label><input maxlength="12" id="sc-name" value="新手冒險者" autocomplete="off" /></div><div class="stat-summary" id="sc-preview"></div><button class="primary" id="sc-confirm">確定建立角色</button></div><div id="sc-error" class="error" role="status"></div></section>`)
    const list=this.root.querySelector('#sc-job-list')
    for(const job of JOBS){
      const btn=document.createElement('button');btn.type='button';btn.className='job-card';btn.dataset.job=job.id
      btn.innerHTML=`<div class="art-bg"><img src="${job.art}" alt="${job.name}原創角色立繪" /></div><strong>${job.name}</strong><small>${job.subtitle}</small>`
      btn.addEventListener('click',()=>{this.selected=job.id;this.renderChoicePreview()})
      list.appendChild(btn)
    }
    this.root.querySelector('#sc-confirm').addEventListener('click',()=>this.confirm())
    this.renderChoicePreview()
  }
  renderChoicePreview(){
    const j=getJob(this.selected)
    this.root.querySelectorAll('.job-card').forEach(el=>{el.classList.toggle('active',el.dataset.job===j.id);el.setAttribute('aria-pressed',String(el.dataset.job===j.id))})
    this.root.querySelector('#sc-preview').innerHTML=`<strong style="color:${j.color}">${j.name}｜${j.subtitle}</strong><div>${j.desc}</div><div>STR ${j.attrs.STR}　DEX ${j.attrs.DEX}　INT ${j.attrs.INT}　LUK ${j.attrs.LUK}</div><div>HP 100 ／ MP ${j.mp}</div>`
  }
  confirm(){
    const name=this.root.querySelector('#sc-name').value.trim()
    if(!validName(name)){this.root.querySelector('#sc-error').textContent='名稱須為 2–12 字，限中英文字、數字、底線、連字號及空格。';return}
    const j=getJob(this.selected)
    const ch={schemaVersion:1,displayName:name,jobId:j.id,level:1,exp:0,attributes:{...j.attrs},hpMax:100,mpMax:j.mp,fusion:{unlocked:false,active:false,activePetId:null,durationMs:0,cooldownMs:0},createdAt:new Date().toISOString()}
    if(!saveCharacter(ch)){this.root.querySelector('#sc-error').textContent='角色資料無法儲存，請檢查瀏覽器儲存設定。';return}
    this.character=ch;this.close();this.updateHud();window.dispatchEvent(new CustomEvent('shenchong:character-created',{detail:{jobId:ch.jobId}}));this.scene.showNotice?.(`已選擇「${j.name}」！按 C 查看角色資訊。`)
  }
  openProfile(){
    if(!this.character){this.openChoice();return}
    const ch=this.character,j=getJob(ch.jobId)
    this.tab='status'
    this.mount(`<section class="window" style="max-width:830px"><div class="head"><div><h2>角色資訊 · ${j.name}</h2><p class="muted">職業造型、初始能力、神寵共鳴預覽</p></div><button type="button" class="small-btn" id="sc-close">關閉 ✕</button></div><div class="profile"><div class="portrait"><img src="${j.art}" alt="${j.name}角色立繪" /></div><div><div class="tabs"><button data-tab="status" class="tab active">角色狀態</button><button data-tab="fusion" class="tab">神寵融合</button></div><div class="panel" id="sc-detail"></div></div></div><p class="muted" style="margin-top:12px">目前為單人原型：地圖上的角色會依職業換裝，尚未加入戰鬥技能或真正的融合變身；目前角色和寵物存檔均不變。</p></section>`)
    this.root.querySelector('#sc-close').addEventListener('click',()=>this.close())
    this.root.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{this.tab=btn.dataset.tab;this.renderProfile()}))
    this.renderProfile()
  }
  renderProfile(){
    const ch=this.character,j=getJob(ch.jobId),p=petInfo()
    this.root.querySelectorAll('.tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===this.tab))
    const detail=this.root.querySelector('#sc-detail')
    if(this.tab==='status') {
      detail.innerHTML=`<div style="font-size:17px;font-weight:bold;color:#ffe5a7">${htmlSafe(ch.displayName)}　Lv.${ch.level}</div><div class="muted">${j.name} · ${j.subtitle}　|　EXP ${ch.exp}</div><div style="margin-top:12px">HP ${ch.hpMax} / ${ch.hpMax}<div class="bar"><span style="width:100%;background:#df6478"></span></div></div><div style="margin-top:10px">MP ${ch.mpMax} / ${ch.mpMax} （預留）<div class="bar"><span style="width:100%;background:#5cabe9"></span></div></div><div class="stat-grid">${Object.entries(ch.attributes).filter(([k])=>['STR','DEX','INT','LUK'].includes(k)).map(([k,v])=>`<div class="stat"><b>${k}</b>　${Number(v)||0}</div>`).join('')}</div><div class="muted" style="margin-top:10px">目前隨行寵物：${p.name} · ${htmlSafe(p.rarity)}　飽食度 ${Math.min(100,Math.max(0,p.hunger))}/100</div>`
    } else {
      const names=['幼龍','靈狐','霜狼']
      detail.innerHTML=`<div style="font-size:18px;font-weight:bold;color:#ffe5a7">✦ 神寵融合（未來功能）</div><p class="muted" style="margin:9px 0">進入融合時，隨行寵物暫時隱藏，角色切換融合造型；持續時間結束後還原原角色外觀，寵物重新跟隨。</p><div class="stat-grid">${names.map((n,i)=>`<div class="stat"><b>${n}</b><div style="font-size:13px">${j.fusion[i]}</div></div>`).join('')}</div><ul class="muted-list"><li>目前職業：${j.name}；目前寵物：${p.name}</li><li>未解鎖：需未來的等級、任務與寵物品階條件</li><li>預計流程：啟動 → 融合倒數 → 自動解除 → 冷卻</li><li>本版沒有融合按鈕，不會修改任何寵物狀態。</li></ul>`
    }
  }
  destroy(){this.root.remove()}
}
