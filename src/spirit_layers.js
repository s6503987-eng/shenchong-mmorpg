// 《神寵》Alpha 0.8.5 — 御靈師第一階段真實裝備圖層（無新存檔）
// 既有職業動作 PNG 是已繪有服裝的完整角色，這版的獨立圖層先提供可穿戴外觀疊層；
// 未來換成無服裝基礎身體素材後，才是完整的 body/garment 分離。
const POSES = new Set(['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land'])
const CONFIG = [
  {slot:'cape', depth:24.7}, // 披風放在主角背後
  {slot:'body', depth:25.12},
  {slot:'head', depth:25.2},
  {slot:'weapon', depth:25.3}
]
export class SpiritLayeredAppearance {
  constructor(scene) {
    this.scene=scene
    this.parts={}
    for(const cfg of CONFIG) {
      this.parts[cfg.slot]=scene.add.image(-900,-900,'__DEFAULT')
        .setDepth(cfg.depth).setVisible(false).setOrigin(.5,.5)
    }
    this.lastPose=''
    scene.events.once('shutdown',()=>{
      Object.values(this.parts).forEach(p=>p.destroy())
    })
  }
  update(pose) {
    const scene=this.scene, player=scene.player, equip=scene.equipment
    if(!player||!equip) return
    const active=scene.activeJobId==='spirit'
    // 其他職業沿用舊版裝備效果，不影響原本穿戴顯示
    const selected=POSES.has(pose)?pose:'idle0'
    const hasLayerAssets=scene.textures.exists(`spirit_layer_head_${selected}`)
    if(equip.visual) equip.visual.setVisible(!active || !hasLayerAssets)
    for(const {slot} of CONFIG) {
      const image=this.parts[slot], gearId=equip.gear?.[slot]
      const key=`spirit_layer_${slot}_${selected}`
      const hasTexture=scene.textures.exists(key)
      if(!active||!gearId||!hasTexture) {image.setVisible(false);continue}
      if(image.texture.key!==key) image.setTexture(key)
      image.setPosition(player.x,player.y).setDisplaySize(94,116)
        .setFlipX(player.flipX).setVisible(true)
    }
  }
}
