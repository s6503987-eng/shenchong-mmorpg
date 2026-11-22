// 《神寵》Alpha 0.9.9：單一入口、自訂快捷鍵（不影響人物美術、背包與角色存檔）
export const KEY_ACTIONS = Object.freeze([
  ['left','向左移動','A','移動'],['right','向右移動','D','移動'],['jump','跳躍','SPACE','移動'],
  ['left2','向左移動（備用）','LEFT','移動'],['right2','向右移動（備用）','RIGHT','移動'],
  ['jump2','跳躍（備用）','W','移動'],['jump3','跳躍（備用二）','UP','移動'],
  ['attack','御靈師普通攻擊','J','戰鬥'],['interact','與 NPC 互動','E','功能'],
  ['hatch','孵化神寵','H','神寵'],['feeding','神寵餵食','F','神寵'],
  ['inventory','背包','I','介面'],['equipment','裝備欄','B','介面'],
  ['character','角色資訊','C','介面'],['wardrobe','外觀介面','V','介面'],
  ['stats','自由配點','P','介面'],['level','等級資訊','L','介面'],
  ['minimap','小地圖','M','介面'],['quest','任務','Q','介面'],
  ['skills','技能','S','介面'],['advancement','御靈師轉職','T','介面'],
  ['skill1','技能欄 1','1','戰鬥'],['skill2','技能欄 2','2','戰鬥'],
  ['skill3','技能欄 3','3','戰鬥'],['skill4','技能欄 4','4','戰鬥'],
  ['skill5','技能欄 5','5','戰鬥'],['skill6','技能欄 6','6','戰鬥'],['escape','關閉／返回','ESC','介面'],
  ['settings','快捷鍵設定','TILDE','介面']
]);
const STORAGE_KEY='shenchong_keybinds_v1';
const SETTINGS_KEY='TILDE'; // Esc 下方的反引號／波浪號實體鍵
export const DEFAULT_BINDINGS=Object.freeze(Object.fromEntries(KEY_ACTIONS.map(([id,,key])=>[id,key])));
const KEY_TO_CODE={ESC:'ESC',SPACE:'SPACE',LEFT:'LEFT',RIGHT:'RIGHT',UP:'UP',DOWN:'DOWN',ENTER:'ENTER',BACKSPACE:'BACKSPACE',TAB:'TAB'};
const FORBIDDEN=new Set(['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','TAB','ENTER','BACKSPACE','DELETE','SHIFT','CTRL','ALT','META','CAPSLOCK','NUMLOCK','SCROLLLOCK','PRINTSCREEN','PAUSE']);
export function eventKey(event){
  if(event?.code==='Backquote')return SETTINGS_KEY;
  const k=String(event?.key||'').toUpperCase();
  if(k==='`'||k==='~')return SETTINGS_KEY;
  const keyName={ARROWLEFT:'LEFT',ARROWRIGHT:'RIGHT',ARROWUP:'UP',ARROWDOWN:'DOWN',ESCAPE:'ESC',' ':'SPACE',SPACEBAR:'SPACE'}[k]||k;
  if (/^KEY[A-Z]$/.test(String(event?.code||'')) && k.length!==1) return String(event.code).slice(3);
  return keyName;
}
export function allowedKey(key){return /^([A-Z]|[0-9]|LEFT|RIGHT|UP|DOWN|SPACE|ESC|TILDE)$/.test(key)&&!FORBIDDEN.has(key);}
export function validateBindings(obj){
  const next={...DEFAULT_BINDINGS};
  if(!obj||typeof obj!=='object')return next;
  // Migration: preserve all existing player bindings, adding new actions without destroying old settings.
  // Prioritize already configured actions, assign a free key to any new action if its default is occupied.
  const known=KEY_ACTIONS.filter(([id])=>id in obj && id!=='settings' && id!=='escape');
  const newcomers=KEY_ACTIONS.filter(([id])=>!(id in obj) && id!=='settings' && id!=='escape');
  const occupied=new Set(['TILDE','ESC']);
  for(const [id,,def] of [...known,...newcomers]){
    const preferred=known.some(([old])=>old===id)?obj[id]:def;
    const options=[preferred,def,...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'LEFT','RIGHT','UP','DOWN','SPACE'];
    const candidate=options.find(k=>typeof k==='string'&&allowedKey(k)&&k!=='TILDE'&&k!=='ESC'&&!occupied.has(k));
    if(!candidate)return {...DEFAULT_BINDINGS};
    next[id]=candidate;occupied.add(candidate);
  }
  next.settings='TILDE';next.escape='ESC';
  return next;
}
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class KeybindSystem {
  constructor(scene){
    this.scene=scene;this.open=false;this.listening=null;this.callbacks=new Map();this.downKeys=new Map();
    let saved=null;try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
    this.bindings=validateBindings(saved);
    // 將過去 K 開啟設定的存檔安全遷移為固定 ~，保留其他玩家配置。
    if(saved && saved.settings!==SETTINGS_KEY)this.persist();
    this.panel=document.createElement('div');this.panel.id='sc-keybind-panel';
    this.panel.style.cssText='position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;background:#05121de8;color:#f6ecdc;font-family:Microsoft JhengHei,Noto Sans TC,Arial,sans-serif;padding:12px;box-sizing:border-box';
    document.body.appendChild(this.panel);
    this.panel.addEventListener('click',e=>{
      if(e.target===this.panel||e.target.closest('[data-kb-close]')){this.close();return;}
      if(e.target.closest('[data-kb-reset]')){this.reset();return;}
      const btn=e.target.closest('[data-kb-rebind]');if(btn){this.listening=btn.dataset.kbRebind;this.notice='請直接按下想設定的鍵';this.render();}
    });
    this.keyHandler=e=>this.onKey(e);
    scene.input.keyboard.on('keydown',this.keyHandler);
    this.register('settings',()=>this.toggle());
    scene.events.once('shutdown',()=>this.destroy());
  }
  register(action,fn){if(typeof fn!=='function'||!(action in this.bindings))throw new Error(`未知快捷鍵功能：${action}`);let callbacks=this.callbacks.get(action);if(!callbacks){callbacks=new Set();this.callbacks.set(action,callbacks);}callbacks.add(fn);}
  unregister(action,fn){this.callbacks.get(action)?.delete(fn);}
  isDown(action){
    if(this.open)return false;
    const name=this.bindings[action];if(!name)return false;
    const code=this.scene.input.keyboard?.addKey(KEY_TO_CODE[name]||name,false);
    return !!code?.isDown;
  }
  onKey(e){
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    const key=eventKey(e);
    if(this.listening){e.preventDefault();e.stopImmediatePropagation?.();if(key==='ESC'){this.listening=null;this.render();return;}
      if(!allowedKey(key)||key==='ESC'||key===SETTINGS_KEY){this.notice='可用 A-Z、0-9、方向鍵或空白鍵；Esc 與 ~ 是保留按鍵';this.render();return;}
      this.rebind(this.listening,key);this.listening=null;this.render();return;
    }
    if(this.open){if(key==='ESC'||key===SETTINGS_KEY){e.preventDefault();e.stopImmediatePropagation?.();this.close();}return;}
    if(e.repeat)return;
    if(e.target?.tagName==='INPUT'||e.target?.tagName==='TEXTAREA'||e.target?.isContentEditable)return;
    const action=Object.keys(this.bindings).find(id=>this.bindings[id]===key);
    if(!action)return;
    if(['SPACE','UP','DOWN','LEFT','RIGHT','TILDE'].includes(key))e.preventDefault();
    for(const fn of this.callbacks.get(action)||[])fn(e);
  }
  rebind(action,key){
    if(!(action in this.bindings)||action==='settings'||!allowedKey(key)||key===SETTINGS_KEY)return false;
    const other=Object.keys(this.bindings).find(id=>id!==action&&this.bindings[id]===key);
    const previous=this.bindings[action];
    if(other){this.bindings[other]=previous;this.notice=`按鍵已交換：「${this.name(action)}」與「${this.name(other)}」`;}
    else this.notice=`已將「${this.name(action)}」改為 ${key}`;
    this.bindings[action]=key;
    this.persist();return true;
  }
  name(action){return KEY_ACTIONS.find(x=>x[0]===action)?.[1]||action;}
  persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.bindings))}catch(e){console.warn('快捷鍵無法儲存',e);}}
  reset(){this.bindings={...DEFAULT_BINDINGS};this.listening=null;this.notice='已還原所有預設快捷鍵';this.persist();this.render();}
  toggle(){this.open?this.close():this.show();}
  show(){this.open=true;this.listening=null;this.panel.style.display='flex';this.render();}
  close(){this.listening=null;this.open=false;this.panel.style.display='none';}
  render(){
    const groups=[...new Set(KEY_ACTIONS.map(x=>x[3]))];
    this.panel.innerHTML=`<section role="dialog" aria-modal="true" aria-label="快捷鍵設定" style="width:min(740px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(150deg,#244962,#0d2032);border:2px solid #e0c18a;border-radius:15px;padding:18px;box-shadow:0 18px 70px #000c;box-sizing:border-box"><header style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><strong style="font-size:22px;color:#ffe3a9">⌨ 玩家快捷鍵設定</strong><div style="color:#bcd7e6;font-size:12px;margin-top:5px">按 ~ 開啟或關閉；點選「修改」再按新鍵即可儲存</div></div><button data-kb-close style="padding:8px 12px;background:#36536c;color:white;border:1px solid #88a1b7;border-radius:8px;cursor:pointer">關閉 ×</button></header><p style="background:#163a52;border:1px solid #4e7b95;border-radius:7px;padding:10px;font-size:13px;color:#b9ebf8">${html(this.notice||'按鍵衝突時會自動交換兩個功能的按鍵。設定自動保存。')}</p>${groups.map(group=>`<div style="font-size:14px;color:#f8dfa5;border-bottom:1px solid #8292a1;margin:15px 0 5px;padding-bottom:6px;font-weight:bold">${html(group)}</div>${KEY_ACTIONS.filter(x=>x[3]===group).map(([id,label])=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 2px;border-bottom:1px solid #456078"><span style="flex:1;font-size:14px">${html(label)}</span><kbd style="display:inline-block;min-width:60px;text-align:center;border:1px solid #a1b3be;border-radius:6px;background:#19384f;padding:6px;color:#ffe3a9;font-weight:bold">${html(this.bindings[id])}</kbd><button ${id==='escape'||id==='settings'?'disabled title="ESC 與 ~ 是保留系統鍵，不可改動"':`data-kb-rebind="${id}"`} style="border:1px solid #b89b69;background:${this.listening===id?'#a86c21':'#456780'};color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">${this.listening===id?'等待按鍵…':'修改'}</button></div>`).join('')}`).join('')}<footer style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:17px;flex-wrap:wrap"><small style="color:#bad1e0">按 ESC 或 ~ 關閉視窗；~ 為固定設定入口</small><button data-kb-reset style="border:1px solid #dda877;border-radius:7px;background:#65412d;color:#fff;padding:8px 12px;cursor:pointer">恢復預設快捷鍵</button></footer></section>`;
  }
  destroy(){this.scene.input.keyboard?.off('keydown',this.keyHandler);this.panel?.remove();this.callbacks.clear();}
}
