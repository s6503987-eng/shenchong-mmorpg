// 《神寵》Alpha 0.8.3 - PC 職業外觀裝扮（不屬於物品背包、不增加能力）
// 本模組不修改角色、寵物、背包原有存檔。
const KEY='shenchong_cosmetic_v1'
const ALLOWED={tint:['original','frost','gold','lavender'],head:['none','gem','laurel'],aura:['none','blue','gold']}
const DEFAULT={tint:'original',head:'none',aura:'none'}
const TINTS={original:0xffffff,frost:0xc9eeff,gold:0xffe6b0,lavender:0xe1cbff}
const LABEL={tint:{original:'原始職業配色',frost:'冰霜色調',gold:'晨金色調',lavender:'暮紫色調'},head:{none:'無頭飾',gem:'星晶冠飾',laurel:'晨曦花冠'},aura:{none:'無光環',blue:'星藍光環',gold:'金色光環'}}
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');const r={...DEFAULT};for(const k of Object.keys(DEFAULT)){if(ALLOWED[k].includes(d?.[k]))r[k]=d[k]}return r}catch{return {...DEFAULT}}}
const style=`
#sc-wardrobe{position:fixed;z-index:99998;left:50%;top:50%;transform:translate(-50%,-50%);width:min(470px,94vw);max-height:88vh;overflow-y:auto;background:linear-gradient(145deg,#294c67,#10283f);border:2px solid #d9bc7d;border-radius:14px;color:#f6eedc;font-family:Microsoft JhengHei,Arial,sans-serif;box-shadow:0 22px 68px #071222cf;padding:18px;box-sizing:border-box}
#sc-wardrobe *{box-sizing:border-box}#sc-wardrobe h2{margin:0;color:#ffdf9e;font-size:23px}
#sc-wardrobe .w-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
#sc-wardrobe .w-close,#sc-wardrobe button{cursor:pointer;border:1px solid #a9b8c6;color:#f8f0de;background:#2d526e;border-radius:8px;padding:9px 10px;font-family:inherit}
#sc-wardrobe .w-close{padding:6px 11px}#sc-wardrobe label{display:block;margin:15px 0 6px;color:#ffe5ad;font-weight:bold;font-size:14px}
#sc-wardrobe select{width:100%;border:1px solid #8eabc4;background:#16344e;color:white;font-size:15px;border-radius:8px;padding:10px}
#sc-wardrobe p{font-size:12px;color:#cad8e4;line-height:1.8}
#sc-wardrobe .w-footer{display:flex;gap:10px;margin-top:15px}#sc-wardrobe button{flex:1}
#sc-wardrobe .save{background:#d8b779;color:#142b42;font-weight:bold}
`
export class WardrobeUI {
  constructor(scene){
    this.scene=scene;this.open=false;this.values=load()
    this.mark=this.scene.add.graphics().setDepth(27)
    this.aura=this.scene.add.graphics().setDepth(23)
    const prev=document.getElementById('sc-wardrobe');if(prev)prev.remove()
    if(!document.getElementById('sc-wardrobe-style')){const el=document.createElement('style');el.id='sc-wardrobe-style';el.textContent=style;document.head.appendChild(el)}
    this.apply()
    this.scene.events.once('shutdown',()=>{this.mark.destroy();this.aura.destroy();document.getElementById('sc-wardrobe')?.remove()})
  }
  apply(){this.scene.player?.setTint(TINTS[this.values.tint]);this.update()}
  toggle(){this.open?this.close():this.show()}
  close(){this.open=false;document.getElementById('sc-wardrobe')?.remove()}
  show(){
    if(this.open)return
    this.open=true
    const root=document.createElement('div');root.id='sc-wardrobe'
    root.innerHTML='<div class="w-head"><h2>✦ 神寵 · 外觀裝扮</h2><button type="button" class="w-close">×</button></div><p>此版本是免費外觀試衣間，不消耗背包道具，不更動屬性。選擇後會直接套用到地圖人物，按儲存保留設定。</p>'
    for(const k of ['tint','head','aura']){
      const label=document.createElement('label');label.textContent=({tint:'職業服裝色調',head:'頭部飾品',aura:'神寵共鳴光環'})[k];root.appendChild(label)
      const select=document.createElement('select');select.name=k
      for(const v of ALLOWED[k]){const option=document.createElement('option');option.value=v;option.textContent=LABEL[k][v];option.selected=this.values[k]===v;select.appendChild(option)}
      select.addEventListener('change',()=>{this.values[k]=select.value;this.apply()});root.appendChild(select)
    }
    const footer=document.createElement('div');footer.className='w-footer'
    const reset=document.createElement('button');reset.textContent='恢復原始外觀';reset.addEventListener('click',()=>{this.values={...DEFAULT};this.apply();this.close();this.show()})
    const save=document.createElement('button');save.className='save';save.textContent='儲存外觀';save.addEventListener('click',()=>{try{localStorage.setItem(KEY,JSON.stringify(this.values));this.scene.showNotice?.('外觀裝扮已儲存')}catch(e){this.scene.showNotice?.('無法儲存外觀，請檢查瀏覽器儲存空間')}this.close()})
    footer.append(reset,save);root.appendChild(footer)
    root.querySelector('.w-close').addEventListener('click',()=>this.close())
    document.body.appendChild(root)
  }
  update(){
    const p=this.scene.player;if(!p)return
    if(this.mark){this.mark.clear();this.mark.setPosition(p.x,p.y).setScale(p.flipX?-1:1,1)
      if(this.values.head==='gem'){
        this.mark.fillStyle(0xecd18c).fillEllipse(0,-48,24,8)
        this.mark.fillStyle(0x4be1f8).fillTriangle(0,-61,-8,-49,8,-49)
      }else if(this.values.head==='laurel'){
        this.mark.lineStyle(4,0x9fcb78).strokeEllipse(0,-48,29,12)
        for(const x of [-10,0,10])this.mark.fillStyle(0xffd89a).fillCircle(x,-53,3)
      }
    }
    if(this.aura){this.aura.clear();this.aura.setPosition(p.x,p.y)
      if(this.values.aura!=='none'){
        const c=this.values.aura==='blue'?0x75d8f9:0xffd37f
        this.aura.lineStyle(3,c,0.62).strokeEllipse(0,0,110,132)
        this.aura.fillStyle(c,0.32).fillCircle(-45,-34,4).fillCircle(42,-19,3).fillCircle(26,48,4)
      }
    }
  }
}
