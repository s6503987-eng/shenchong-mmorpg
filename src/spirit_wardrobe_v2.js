// 《神寵》御靈師固定人物外觀：任何裝備穿戴都不改變角色美術。
// 完全保留 EquipmentUI / InventoryUI 與角色物理碰撞，不寫入存檔。
export const SHENCHONG_COMPLETE_POSES = Object.freeze([
  'idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land'
]);
const ROOT='/assets/shenchong_complete/spirit';
const VALID={
  head:new Set(['equip_head','spirit_head']),
  cape:new Set(['equip_cape','spirit_cape']),
  weapon:new Set(['equip_orb','spirit_weapon'])
};
const DEPTH={cape:24.8,head:25.2,weapon:25.3};
const SLOTS=['cape','head','weapon'];
const JOB_ITEMS={warrior:['warrior_head','warrior_outfit','warrior_cape','warrior_weapon'],mage:['mage_head','mage_outfit','mage_cape','mage_weapon'],archer:['archer_head','archer_outfit','archer_cape','archer_weapon'],spirit:['spirit_head','spirit_outfit','spirit_cape','spirit_weapon']};

export class SpiritWardrobeV2 {
  constructor(scene){
    this.scene=scene;this.parts={};this.lastPreview='';this.giftButton=null;
    for(const slot of SLOTS){
      this.parts[slot]=scene.add.image(-900,-900,'__DEFAULT')
        .setOrigin(.5,.5).setDisplaySize(94,116).setDepth(DEPTH[slot]).setVisible(false);
    }
    scene.events.once('shutdown',()=>{
      for(const img of Object.values(this.parts))img.destroy();
      this.giftButton?.remove();
      // 恢復原本免費外觀試衣間的可見狀態，其他職業不受影響。
      scene.wardrobe?.mark?.setVisible(true);
      scene.wardrobe?.aura?.setVisible(true);
    });
  }
  hideLegacy(){
    const s=this.scene;
    // 先前版本的 Phaser Graphics 皇冠和舊紙娃娃可能每幀重畫：一律由新版在最後隱藏。
    s.equipment?.visual?.setVisible(false);
    for(const img of Object.values(s.spiritLayers?.parts||{})) img?.setVisible(false);
    // wardrobe.js 可以另外畫一枚皇冠與光環；這些並非實際裝備，因此避免疊在頭上。
    s.wardrobe?.mark?.setVisible(false);
    s.wardrobe?.aura?.setVisible(false);
    // 有些舊版本還保留一張「完整套裝浮圖」；只關閉已存在的顯示物件，不 destroy。
    for(const obj of [s.spiritWardrobeV2?.completeHero,s.completeHero]){
      if(obj && obj!==s.player && obj!==this.parts.head && obj!==this.parts.cape && obj!==this.parts.weapon){
        obj.setVisible?.(false);
      }
    }
  }
  ensureGift(){
    const ui=this.scene.equipment;
    if(!ui?.el||ui.giftCurrentJob||this.giftButton)return;
    const target=ui.el.querySelector('.eq-main');if(!target)return;
    const b=document.createElement('button');b.textContent='領取本職業四件初始裝備';
    b.style.cssText='display:block;width:100%;margin:9px 0;padding:9px';
    b.addEventListener('click',()=>{
      const job=ui.job?.()||this.scene.activeJobId;
      const ids=JOB_ITEMS[job],inv=this.scene.inventory;
      if(!ids||!inv){ui.notice?.('請先建立角色並開啟背包');return;}
      const marker='shenchong_complete_gift_'+job+'_v1';
      if(localStorage.getItem(marker)==='yes'){ui.notice?.('這個職業的裝備已領取');return;}
      const free=inv.slots.map((v,i)=>!v&&!inv.locked.has(i)?i:-1).filter(i=>i>=0);
      if(free.length<4){ui.notice?.('需要四個未鎖定的背包空格');return;}
      ids.forEach((id,i)=>inv.slots[free[i]]={id,qty:1});
      inv.save();inv.refresh();ui.render();localStorage.setItem(marker,'yes');
      ui.notice?.('已取得本職業四件初始裝備');
    });
    target.appendChild(b);this.giftButton=b;
  }
  // 裝備只記錄在 EquipmentUI，不再影響人物外觀。
  // 固定顯示既有的華麗御靈師 costume；十二格動作仍按原遊戲 pose 更新。
  update(pose){
    const s=this.scene, p=s.player;
    if(!p)return;
    for(const img of Object.values(this.parts))img.setVisible(false);
    if(s.activeJobId!=='spirit'){
      s.wardrobe?.mark?.setVisible(true);
      s.wardrobe?.aura?.setVisible(true);
      return;
    }
    this.hideLegacy();
    const motion=SHENCHONG_COMPLETE_POSES.includes(pose)?pose:'idle0';
    const fixedCostume='resonance';
    const key=`scComplete_costume_${fixedCostume}_${motion}`;
    p.setVisible(true);
    if(s.textures.exists(key) && p.texture.key!==key){
      p.setTexture(key).setDisplaySize(94,116);
      p.body?.setSize(90,190).setOffset(55,48);
    }
    // 不根據裝備欄決定貼圖：頭飾、披風、武器全部不加畫。
    this.ensureGift();
    this.syncPreview(fixedCostume);
  }
  syncPreview(costume){
    const ui=this.scene.equipment;
    if(!ui?.open||(ui.tab&&ui.tab!=='equipment'))return;
    const doll=ui.el?.querySelector('.eq-doll');
    if(!doll)return;
    const signature=`fixed-${costume}`;
    if(doll.dataset.scComplete===signature && doll.children.length===1)return;
    doll.replaceChildren();
    doll.dataset.scComplete=signature;
    const img=document.createElement('img');
    img.src=`${ROOT}/costumes/${costume}/idle0.png`;
    img.alt='御靈師固定人物外觀';
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:2;pointer-events:none';
    img.onerror=()=>img.remove();
    doll.appendChild(img);
  }
}

// SC_FIXED_SPIRIT_PREVIEW_2026: 防止舊換裝模組把 B 裝備視窗改回簡化法袍圖。
// 只處理 DOM 預覽，不修改人物貼圖、動畫、裝備穿戴或存檔。
SpiritWardrobeV2.prototype.syncPreview = function() {
  const ui=this.scene?.equipment;
  if(!ui?.open || (ui.tab && ui.tab!=='equipment'))return;
  const doll=ui.el?.querySelector('.eq-doll');
  if(!doll || this.scene?.activeJobId!=='spirit')return;
  if(doll.dataset.scFixedOriginal==='yes' && doll.children.length===1)return;
  doll.replaceChildren();
  const picture=document.createElement('img');
  picture.src='/assets/job_motion/spirit_idle0.png';
  picture.alt='御靈師原始角色美術（固定外觀）';
  picture.className='body';
  picture.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:1';
  doll.appendChild(picture);
  doll.dataset.scFixedOriginal='yes';
};
