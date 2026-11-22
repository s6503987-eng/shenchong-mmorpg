// 《神寵》Alpha 0.8.3.2：四職業動畫一致性修正（保留原遊戲功能）
import Phaser from 'phaser'
import { KeybindSystem } from './keybinds.js'
import { SpiritSkillSystem } from './spirit_skills.js'
import { SpiritAdvancementSystem } from './spirit_advancement.js'
import { AttributeSystem } from './attributes.js'
import { LevelSystem } from './progression.js'
import { BasicAttackSystem } from './basic_attack.js'
import { InventoryUI } from './inventory.js'
import { CharacterUI, readCharacter } from './character.js'
import { WardrobeUI } from './wardrobe.js'
import { EquipmentUI } from './equipment.js'
import { SpiritLayeredAppearance } from './spirit_layers.js'
import { SpiritWardrobeV2 } from './spirit_wardrobe_v2.js'

// 《神寵》Alpha 0.6.8 — 原創 PC HUD 改版，保留幼龍逐格動畫（保留靈狐、霜狼、村莊、養成）
// 本版採用一張完整美術背景：地面碰撞、NPC、玩家與入口為獨立 Phaser 物件。
const WIDTH = 1200
const HEIGHT = 675
const WORLD_WIDTH = 2400
const FLOOR_Y = 490
// 移動手感可在此統一調整，數值均為每秒單位
const MOVE = {
  maxSpeed: 260,
  groundAcceleration: 1900,
  airAcceleration: 1200,
  groundFriction: 2300,
  airDrag: 370,
  jumpSpeed: 485,
  gravity: 1150,
  coyoteTimeMs: 100,
  jumpBufferMs: 110,
  jumpCutRatio: 0.48
}
const NPC_HEIGHT = 116
// 獨立的速度逼近函式，避免 Phaser 版本差異造成 update() 中斷。
function approach(current, target, maxDelta) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(maxDelta)) return 0
  const delta = Math.max(0, maxDelta)
  if (Math.abs(target - current) <= delta) return target
  return current + Math.sign(target - current) * delta
}
const SAVE_KEY = 'shenchong_alpha050_pet_v1'
const PET_TYPES = [
  { id: 'dragon', name: '幼龍', color: 0x69c8de },
  { id: 'fox', name: '靈狐', color: 0xf8ad65 },
  { id: 'wolf', name: '霜狼', color: 0xadd3f5 }
]
// 初始品階為原型測試權重；日後正式遊戲必須在伺服器抽取。
const RARITIES = [
  { name: '普通', weight: 50, color: '#e8e7df' },
  { name: '優秀', weight: 30, color: '#83e29a' },
  { name: '稀有', weight: 13, color: '#82bbff' },
  { name: '史詩', weight: 5, color: '#d2a1ff' },
  { name: '傳說', weight: 1.8, color: '#ffdc83' },
  { name: '神話', weight: 0.2, color: '#ff9c81' }
]
const FOOD_TYPES = [
  { id: 'basic', name: '普通獸糧', value: 5 },
  { id: 'fresh', name: '鮮肉', value: 10 },
  { id: 'fruit', name: '靈果', value: 20 }
]
function blankSave() { return { egg: false, pet: null, food: { basic: 0, fresh: 0, fruit: 0 }, awakenings: 0 } }
function loadPetSave() {
  const safe = blankSave()
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
    if (!data || typeof data !== 'object') return safe
    const pet = data.pet && PET_TYPES.some(p => p.id === data.pet.type) &&
      RARITIES.some(r => r.name === data.pet.rarity)
      ? { type: data.pet.type, rarity: data.pet.rarity,
          hunger: Phaser.Math.Clamp(Number(data.pet.hunger) || 0, 0, 100) } : null
    const food = {}
    for (const item of FOOD_TYPES) {
      const n = Number(data.food?.[item.id]) || 0
      food[item.id] = Math.min(9999, Math.max(0, Math.floor(n)))
    }
    return { egg: pet ? false : data.egg === true, pet, food,
      awakenings: Math.max(0, Math.floor(Number(data.awakenings) || 0)) }
  } catch { return safe }
}
function rollRarity() {
  let roll = Math.random() * 100
  for (const rarity of RARITIES) {
    roll -= rarity.weight
    if (roll < 0) return rarity
  }
  return RARITIES[RARITIES.length - 1]
}


const root = document.getElementById('app')
if (!root) throw new Error('找不到 #app，請確認仍使用 Vite 預設 index.html')
document.body.style.cssText = 'margin:0;background:#152333;overflow:hidden'
root.innerHTML = ''
root.style.cssText = 'width:100vw;height:100vh;display:flex;align-items:center;justify-content:center'

class Village extends Phaser.Scene {
  constructor() { super('Village') }

  preload() {
    // Alpha 1.0.1 御靈師攻擊逐格動畫（可在 restore.cjs 還原）
    for (let i=0; i<8; i++) this.load.image(`sc101_spirit_cast_${i}`, `/assets/spirit_cast/cast${i}.png`)

    this.load.image('village', '/assets/dawn_village_bg.png')
    for(const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
      this.load.image(`sc091c_front_hands_${pose}`, `/assets/paperdoll/spirit/foreground_hands/${pose}.png`)
    }
    // Alpha 0.9.1d: split garment layer, keeping legs visible in run/jump.
    for(const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
      this.load.image(`sc091d_outfit_back_${pose}`, `/assets/paperdoll/spirit/outfit_back/${pose}.png`)
      this.load.image(`sc091d_outfit_front_${pose}`, `/assets/paperdoll/spirit/outfit_front/${pose}.png`)
    }
    this.load.image('sc091b_base_worn_idle0', '/assets/layers/spirit_v2/base_worn/idle0.png')
    // Alpha 0.8.9.4: 全套聖靈共鳴高品質外觀，與現有紙娃娃圖層共存
    this.load.image('sc094_holy_spirit_full', '/assets/layers/spirit_v2/hero/holy_resonance_full.png')
    this.load.image('npc_merchant', '/assets/npc/merchant.png')
    this.load.image('npc_scholar', '/assets/npc/scholar.png')
    this.load.image('npc_elder', '/assets/npc/elder.png')
    for (const pet of PET_TYPES) this.load.image(`pet_${pet.id}`, `/assets/pets/${pet.id}.png`)
    // 僅靈狐使用新增逐格素材，其他寵物保留舊圖。
    for (let i = 0; i < 15; i++) {
      const key = `fox_anim_${String(i).padStart(2, '0')}`
      this.load.image(key, `/assets/pets/fox_animation/fox_${String(i).padStart(2, '0')}.png`)
    }
    // 霜狼專用動畫；缺少素材會回退到 wolf.png，其他寵物維持原樣。
    for (let i = 0; i < 15; i++) {
      const key = `wolf_anim_${String(i).padStart(2, '0')}`
      this.load.image(key, `/assets/pets/wolf_animation/wolf_${String(i).padStart(2, '0')}.png`)
    }
    // 幼龍專用動畫；缺少素材時回退 dragon.png。
    for (let i = 0; i < 15; i++) {
      const key = `dragon_anim_${String(i).padStart(2, '0')}`
      this.load.image(key, `/assets/pets/dragon_animation/dragon_${String(i).padStart(2, '0')}.png`)
    }
    for (const pose of ['idle','run1','run2','jump']) {
      this.load.image(`hero_${pose}`, `/assets/hero/${pose}.png`)
    }
    // 四職業地圖動畫素材；缺少圖片時回退原本 hero 圖。
    for (const job of ['warrior','mage','archer','spirit']) {
      for (const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
        this.load.image(`motion_${job}_${pose}`, `/assets/job_motion/${job}_${pose}.png`)
      }
    }
    // Alpha 0.8.5:御靈師四種裝備的12姿勢圖層，不影響其他職業與角色物理。
    for (const slot of ['cape','body','head','weapon']) {
      for (const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
        this.load.image(`spirit_layer_${slot}_${pose}`, `/assets/layers/spirit/${slot}/${pose}.png`)
      }
    }
    // Alpha 0.8.6: 御靈師無華麗法袍的基礎冒險服＋獨立裝備圖層。
    // Alpha 0.9.0: 按各個裝備 ID 載入各自 12 格，不與其他裝備共用圖層。
    for (const id of ['equip_head','equip_armor','equip_cape','equip_orb',
                     'spirit_head','spirit_outfit','spirit_cape','spirit_weapon']) {
      for (const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
        this.load.image(`sc0900_${id}_${pose}`, `/assets/paperdoll/spirit/${id}/${pose}.png`)
      }
    }
    for (const pose of ['idle0','idle1','idle2','run0','run1','run2','run3','run4','run5','jump','fall','land']) {
      this.load.image(`sc086_base_${pose}`, `/assets/layers/spirit_v2/base/${pose}.png`)
      for (const slot of ['head','outfit','cape','weapon']) {
        this.load.image(`sc086_${slot}_${pose}`, `/assets/layers/spirit_v2/${slot}/${pose}.png`)
        // Alpha 0.8.9.3: 正式御靈師四件裝備，與舊裝備分開載入。
        this.load.image(`sc093_${slot}_${pose}`, `/assets/layers/spirit_v2/formal/${slot}/${pose}.png`)
      }
    }
    for (const job of ['warrior','mage','archer','spirit']) {
      for (const pose of ['idle','run1','run2','jump']) {
        this.load.image(`job_${job}_${pose}`, `/assets/job_sprites/${job}_${pose}.png`)
      }
    }
    this.load.on('loaderror', file => console.error('美術圖片讀取失敗:', file?.src))
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, HEIGHT)

    // 兩張拼接的晨曦村場景：第二張左右翻轉，形成延伸長街。
    this.add.image(WIDTH / 2, HEIGHT / 2, 'village').setDisplaySize(WIDTH, HEIGHT).setDepth(-30)
    // 第二張從 x=1200 開始，鏡像拼接使兩張圖的接縫一致。
    this.add.image(WIDTH * 1.5, HEIGHT / 2, 'village').setDisplaySize(WIDTH, HEIGHT).setFlipX(true).setDepth(-30)

    // 物理碰撞不依賴背景圖：這是之後替換分層地圖的基礎。
    const makeRectTexture = (name, w, h) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      g.fillStyle(0xffffff, 1).fillRect(0, 0, w, h)
      g.generateTexture(name, w, h)
      g.destroy()
    }
    makeRectTexture('solid', 8, 8)
    this.ground = this.physics.add.staticGroup()
    const floor = this.ground.create(WORLD_WIDTH / 2, FLOOR_Y + 60, 'solid').setVisible(false)
    floor.setDisplaySize(WORLD_WIDTH, 120).refreshBody()

    // 有碰撞判定的木製跳台：作為上層道路機制測試。
    this.platforms = this.physics.add.staticGroup()
    this.addPlatform(820, 386, 145)
    this.addPlatform(1580, 382, 145)

    this.createActorTextures()
    // 使用已儲存的角色職業，不更改碰撞、玩家速度或存檔。
    this.activeJobId = readCharacter()?.jobId || null
    const startingTexture = this.jobTexture('idle')
    this.player = this.physics.add.sprite(570, FLOOR_Y - 64, startingTexture).setDepth(25)
    this.player.setDisplaySize(94, 116)
    this.player.lastPose = 'idle'
    this.player.setCollideWorldBounds(true)
    // 碰撞框以原始 200x248 角色圖為座標，縮放後寬約 42、高約 89；貼近人物腳部。
    this.player.body.setSize(90, 190).setOffset(55, 48)
    this.player.setMaxVelocity(MOVE.maxSpeed, 900)
    this.lastGroundedAt = 0
    this.lastJumpPressedAt = -9999
    this.wasJumpDown = false
    this.wasGrounded = false
    this.lastStepAt = 0
    this.physics.add.collider(this.player, this.ground)
    this.physics.add.collider(this.player, this.platforms)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.10)
    this.cameras.main.setDeadzone(200, 110)

    // 玩家腳下的細緻落地影：角色和 NPC 共用相同地面基準。
    this.playerShadow = this.add.ellipse(this.player.x, FLOOR_Y - 1, 60, 10, 0x1e293b, 0.24)
      .setDepth(20)
    this.petSave = loadPetSave()
    // NPC 使用獨立透明 PNG，尺寸統一。
    this.npcs = [
      { x: 185, name: '雜貨商人', art: 'npc_merchant', height: NPC_HEIGHT, line: '歡迎光臨！將來能在這裡買到寵物飼料和冒險道具。' },
      { x: 1030, name: '寵物學者', art: 'npc_scholar', height: NPC_HEIGHT, line: '傳說中的神寵蛋，會因你的培養而覺醒未知品階。' },
      { x: 1760, name: '晨曦村長', art: 'npc_elder', height: NPC_HEIGHT, line: '冒險者，歡迎來到晨曦村！先去認識寵物學者吧。' }
    ]
    this.npcs.forEach(npc => this.addNpc(npc))
    this.portals = [
      { x: 1245, name: '晨曦森林', line: '森林尚在建造中，之後會有新手怪物和寵物飼料。' },
      { x: 2215, name: '聖光城', line: '聖光城尚未開放，後續會成為玩家的第一主城。' }
    ]
    this.portals.forEach(portal => this.addPortal(portal))
    // SC099_CUSTOM_KEYS
    this.keybinds = new KeybindSystem(this)
    this.dialogOpen = false
    this.createHud()
    this.createFeedingPanel()
    this.toggleFeedingPanel(false)
    this.inventory = new InventoryUI(this)
    this.characterUI = new CharacterUI(this)
    this.wardrobe = new WardrobeUI(this)
    // SC_BASIC_ATTACK_V1
    this.equipment = new EquipmentUI(this)
    this.basicAttack = new BasicAttackSystem(this)
    this.spiritLayers = new SpiritLayeredAppearance(this)
    this.spiritWardrobeV2 = new SpiritWardrobeV2(this)
    // SC_LEVEL200_V1
    this.progression = new LevelSystem(this)
    // SC_STATS098_START
    this.stats = new AttributeSystem(this)
    // SC102 SPIRIT SKILLS
    this.advancement = new SpiritAdvancementSystem(this);
    this.spiritSkills = new SpiritSkillSystem(this);
    this.landingUntil = 0
    this.motionLast = null
    // 距離驅動跑步循環：避免低速時「腳在空轉」，不變更玩家物理碰撞。
    this.runCycleTravel = 0
    this.wasMovingForAnim = false
    this.idleAnimStartedAt = 0
    // 首次創角確認後立即同步地圖模型，不必重開遊戲。
    this.onCharacterCreated = () => this.syncJobAppearance()
    window.addEventListener('shenchong:character-created', this.onCharacterCreated)
    this.events.once('shutdown', () => window.removeEventListener('shenchong:character-created', this.onCharacterCreated))
    this.keybinds.register('interact', () => this.interact())
    this.keybinds.register('hatch', () => { if (!this.dialogOpen && !this.characterUI?.isBlocking()) this.hatchEgg() })
    this.spawnOwnedPet()
    this.refreshPetHud()
    this.keybinds.register('escape', () => {
      if (this.advancement?.open) this.advancement.toggle(false)
      else if (this.spiritSkills?.open) this.spiritSkills.toggle(false)
      else if (this.progression?.open) this.progression.toggle(false)
      else if (this.stats?.open) this.stats.toggle(false)
      else if (this.characterUI?.isBlocking()) this.characterUI.close()
      else if (this.equipment?.open) this.equipment.toggle(false)
      else if (this.wardrobe?.open) this.wardrobe.close()
      else if (this.inventory?.open) this.inventory.toggle(false)
      else if (this.feedingOpen) this.toggleFeedingPanel(false)
      else this.closeDialog()
    })
    for (const [actionId, action] of [
      ['feeding', () => this.toggleFeedingPanel()],
      ['minimap', () => { this.minimapOpen = !this.minimapOpen; for (const el of this.miniParts) el.setVisible(this.minimapOpen) }],
      ['inventory', () => this.inventory.toggle()],
      ['character', () => this.characterUI.toggle()],
      ['wardrobe', () => this.wardrobe.toggle()],
      ['equipment', () => this.equipment.toggle()],
      ['quest', () => this.showNotice('任務系統尚在開發中')],
      ['skills', () => this.spiritSkills?.toggle()]
    ]) this.keybinds.register(actionId, () => { if (!this.dialogOpen && !this.characterUI?.isBlocking()) action() })
    this.minimapOpen = true
  }

  jobTexture(pose) {
    const name = this.activeJobId ? `job_${this.activeJobId}_${pose}` : null
    return name && this.textures.exists(name) ? name : `hero_${pose}`
  }

  syncJobAppearance() {
    const id = readCharacter()?.jobId || null
    if (this.activeJobId === id) return
    this.activeJobId = id
    if (this.player) {
      this.player.setTexture(this.jobTexture(this.player.lastPose || 'idle'))
      this.player.setDisplaySize(94,116)
      this.player.body.setSize(90,190).setOffset(55,48)
    }
    if (this.hudPortrait) this.hudPortrait.setTexture(this.jobTexture('idle')).setDisplaySize(45,56)
  }

  createActorTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    // Q 版主角：獨立於場景，後續可替換成動作精靈圖。
    g.fillStyle(0x14252c, 0.25).fillEllipse(34, 79, 54, 11)
    g.fillStyle(0x3d4f94).fillRoundedRect(17, 49, 34, 24, 7)
    g.fillStyle(0xf8d7b2).fillRoundedRect(12, 51, 8, 20, 4)
    g.fillRoundedRect(49, 51, 8, 20, 4)
    g.fillStyle(0x273b65).fillRoundedRect(20, 67, 13, 12, 3)
    g.fillRoundedRect(37, 67, 13, 12, 3)
    g.fillStyle(0x554342).fillRoundedRect(17, 76, 18, 5, 2)
    g.fillRoundedRect(35, 76, 18, 5, 2)
    g.fillStyle(0xf9dabc).fillCircle(35, 30, 24)
    g.fillStyle(0xcbd5e7).fillEllipse(35, 15, 52, 29)
    g.fillStyle(0xe8eff9).fillTriangle(9, 18, 20, 0, 26, 22)
    g.fillTriangle(24, 12, 40, 0, 44, 23)
    g.fillTriangle(43, 12, 58, 4, 61, 29)
    g.fillStyle(0x303c69).fillEllipse(26, 33, 6, 9)
    g.fillEllipse(44, 33, 6, 9)
    g.fillStyle(0xffffff).fillCircle(27, 30, 2)
    g.fillCircle(45, 30, 2)
    g.fillStyle(0xf3a4a5, 0.62).fillEllipse(18, 41, 11, 5)
    g.fillEllipse(52, 41, 11, 5)
    g.lineStyle(2, 0xb96f6c).lineBetween(33, 43, 38, 43)
    g.generateTexture('hero', 70, 85)
    g.clear()
    // NPC 為可分離的簡易精靈，不是背景裡的一部分。
    g.fillStyle(0x233447, 0.25).fillEllipse(27, 65, 42, 9)
    g.fillStyle(0x5c78a1).fillRoundedRect(12, 38, 31, 30, 6)
    g.fillStyle(0xf2d0a8).fillCircle(27, 23, 19)
    g.fillStyle(0xd5d6e2).fillEllipse(27, 11, 38, 18)
    g.fillStyle(0x34435c).fillCircle(21, 26, 2.8)
    g.fillCircle(33, 26, 2.8)
    g.generateTexture('npc', 55, 72)
    g.destroy()
  }

  savePet() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.petSave)) }
    catch (err) { console.warn('本機儲存失敗，重新整理可能遺失進度', err) }
  }

  receiveEgg() {
    if (this.petSave.pet) {
      return '你已經有一隻神寵夥伴！下一階段將開放餵食與再次覺醒。'
    }
    if (this.petSave.egg) {
      return '你的神秘寵物蛋已經在背包中。關閉對話後按 H 或點擊右側「孵化」！'
    }
    this.petSave.egg = true
    this.savePet()
    this.inventory?.refresh()
    this.refreshPetHud()
    return '送你一顆「神秘寵物蛋」！關閉對話，按 H 或點擊右側「孵化」開始冒險。'
  }

  hatchEgg() {
    if (!this.petSave.egg || this.petSave.pet) return
    const type = Phaser.Utils.Array.GetRandom(PET_TYPES)
    const rarity = rollRarity()
    this.petSave = { ...this.petSave, egg: false, pet: { type: type.id, rarity: rarity.name, hunger: 0 } }
    this.savePet()
    this.spawnOwnedPet()
    this.refreshPetHud()
    this.refreshFeedingPanel()
    this.inventory?.refresh()
    this.showNotice(`孵化成功！獲得【${rarity.name}】${type.name}！`)
  }

  spawnOwnedPet() {
    if (this.petSprite) { this.petSprite.destroy(); this.petSprite = null }
    if (this.petShadow) { this.petShadow.destroy(); this.petShadow = null }
    if (this.petNameLabel) { this.petNameLabel.destroy(); this.petNameLabel = null }
    if (!this.petSave.pet) return
    const type = PET_TYPES.find(p => p.id === this.petSave.pet.type)
    const rarity = RARITIES.find(r => r.name === this.petSave.pet.rarity)
    if (!type || !rarity) return
    this.petFeetY = FLOOR_Y
    this.petVelocityY = 0
    this.petJumpCooldown = 0
    this.petStride = 0
    this.petSpeedX = 0
    this.petWasAirborne = false
    this.petLastDustAt = 0
    this.petLastX = this.player.x - 95
    this.foxAnimIndex = -1
    this.wolfAnimIndex = -1
    this.dragonAnimIndex = -1
    this.petShadow = this.add.ellipse(this.petLastX, FLOOR_Y, 60, 12, 0x122637, 0.25).setDepth(22)
    const initialFox = type.id === 'fox' && this.textures.exists('fox_anim_00')
    const initialWolf = type.id === 'wolf' && this.textures.exists('wolf_anim_00')
    const initialDragon = type.id === 'dragon' && this.textures.exists('dragon_anim_00')
    const initialTexture = initialFox ? 'fox_anim_00' : initialWolf ? 'wolf_anim_00' : initialDragon ? 'dragon_anim_00' : `pet_${type.id}`
    this.petSprite = this.add.image(this.petLastX, FLOOR_Y, initialTexture)
      .setOrigin(0.5, 1).setDisplaySize(91, 91).setDepth(24)
    this.petNameLabel = this.add.text(this.petSprite.x, FLOOR_Y - 110,
      `${rarity.name} · ${type.name}`, {
        fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '15px',
        fontStyle: 'bold', color: rarity.color, stroke: '#1c334e', strokeThickness: 4
      }).setOrigin(.5).setDepth(30)
  }

  refreshPetHud() {
    if (!this.petHud) return
    if (this.petSave.pet) {
      const type = PET_TYPES.find(p => p.id === this.petSave.pet.type)
      this.petHud.setText(`寵物：${this.petSave.pet.rarity} ${type.name}  ·  飽食 ${this.petSave.pet.hunger || 0}/100`)
      this.hatchButton.setVisible(false)
    } else if (this.petSave.egg) {
      this.petHud.setText('背包：神秘寵物蛋 ×1')
      this.hatchButton.setVisible(true)
    } else {
      this.petHud.setText('尚無寵物 · 請找寵物學者領蛋')
      this.hatchButton.setVisible(false)
    }
  }

  showNotice(message) {
    this.notice?.destroy()
    this.notice = this.fixedText(WIDTH / 2, 130, message, 25).setOrigin(.5)
    this.time.delayedCall(3600, () => {
      if (this.notice?.active) this.notice.destroy()
      this.notice = null
    })
  }

  // 輕量地面腳步粒子，會自動消失，不進入存檔。
  petFootstep(x, y, isLanding = false) {
    const size = isLanding ? 8 : 4
    for (let i = 0; i < (isLanding ? 3 : 1); i++) {
      const dust = this.add.circle(x + (i - 1) * 11, y - 3, size, 0xfff1d0, 0.45).setDepth(21)
      this.tweens.add({ targets: dust,
        x: dust.x + (i - 1) * 13,
        y: dust.y - (isLanding ? 20 : 12),
        alpha: 0, scale: 0.3, duration: 260,
        onComplete: () => dust.destroy()
      })
    }
  }

  updatePet(time, delta) {
    if (!this.petSprite || !this.player?.body) return
    const dt = Math.min(delta / 1000, 0.04)
    const targetX = Phaser.Math.Clamp(
      this.player.x + (this.player.flipX ? 92 : -92), 35, WORLD_WIDTH - 35
    )
    let gap = targetX - this.petSprite.x

    // 拉得太遠時安全回位，避免跨畫面後寵物永久走失。
    if (Math.abs(gap) > 530) {
      this.petSprite.x = targetX
      this.petSpeedX = 0
      this.petFeetY = FLOOR_Y
      this.petVelocityY = 0
      gap = 0
    }

    const walking = Math.abs(gap) > 12
    const desiredSpeed = walking ? Math.sign(gap) * Math.min(325, Math.max(55, Math.abs(gap) * 3.1)) : 0
    this.petSpeedX = approach(this.petSpeedX, desiredSpeed, (walking ? 1050 : 1550) * dt)
    const move = this.petSpeedX * dt
    this.petSprite.x += Math.abs(move) > Math.abs(gap) && walking ? gap : move
    if (!walking && Math.abs(this.petSpeedX) < 8) this.petSpeedX = 0
    if (Math.abs(this.petSpeedX) > 12) this.petSprite.setFlipX(this.petSpeedX < 0)

    const speedRatio = Math.min(1, Math.abs(this.petSpeedX) / 270)
    this.petStride += dt * (5 + speedRatio * 12)

    const playerFeet = this.player.body.bottom
    const playerOnPlatform = this.player.body.blocked.down && playerFeet < FLOOR_Y - 28
    const landingY = playerOnPlatform && Math.abs(gap) < 170 ? playerFeet : FLOOR_Y
    this.petJumpCooldown = Math.max(0, this.petJumpCooldown - dt)
    const shouldJump =
      (playerOnPlatform && this.petFeetY > landingY + 22) ||
      (this.player.body.velocity.y < -185 && Math.abs(gap) < 155)

    if (shouldJump && this.petJumpCooldown === 0 && Math.abs(this.petVelocityY) < 0.5 &&
        this.petFeetY >= FLOOR_Y - 2) {
      this.petVelocityY = -455
      this.petJumpCooldown = 0.58
    }

    if (this.petVelocityY !== 0 || this.petFeetY < landingY - 1) {
      this.petVelocityY += 1150 * dt
      this.petFeetY += this.petVelocityY * dt
      if (this.petFeetY >= landingY) {
        this.petFeetY = landingY
        this.petVelocityY = 0
      }
    } else if (this.petFeetY > landingY + 1 && this.petJumpCooldown === 0) {
      this.petFeetY = landingY
    }
    const airborne = this.petVelocityY !== 0 || this.petFeetY < landingY - 1
    const justLanded = this.petWasAirborne && !airborne
    if (justLanded) this.petFootstep(this.petSprite.x, landingY, true)
    this.petWasAirborne = airborne

    // 靈狐專用逐格動畫：待機 0–4、奔跑 5–9、跳躍 10–13、落地 14。
    // 若任一動畫圖片缺失，會回退舊版 fox.png，不影響其他寵物。
    if (this.petSave.pet?.type === 'fox') {
      const phase = airborne ? 'jump' : (speedRatio > 0.16 ? 'run' : 'idle')
      const frame = justLanded ? 14 : phase === 'jump'
        ? (this.petVelocityY < -120 ? 11 : this.petVelocityY > 130 ? 13 : 12)
        : phase === 'run'
          ? 5 + (Math.floor(time / 95) % 5)
          : Math.floor(time / 230) % 5
      const key = `fox_anim_${String(frame).padStart(2, '0')}`
      if (frame !== this.foxAnimIndex && this.textures.exists(key)) {
        this.petSprite.setTexture(key)
        this.foxAnimIndex = frame
      }
    }
    // 霜狼逐格動畫：0–4 待機，5–9 奔跑，10–13 跳躍，14 落地。
    // 未載入狼動畫時保留舊版靜態圖片，不影響靈狐及幼龍。
    if (this.petSave.pet?.type === 'wolf' && this.textures.exists('wolf_anim_00')) {
      const phase = airborne ? 'jump' : (speedRatio > 0.16 ? 'run' : 'idle')
      const frame = justLanded ? 14 : phase === 'jump'
        ? (this.petVelocityY < -120 ? 11 : this.petVelocityY > 130 ? 13 : 12)
        : phase === 'run'
          ? 5 + (Math.floor(time / 95) % 5)
          : Math.floor(time / 230) % 5
      const key = `wolf_anim_${String(frame).padStart(2, '0')}`
      if (frame !== this.wolfAnimIndex && this.textures.exists(key)) {
        this.petSprite.setTexture(key)
        this.wolfAnimIndex = frame
      }
    }
    // 幼龍逐格動畫：0–4 待機、5–9 奔跑、10–13 跳躍、14 落地。
    // 影格讀不到時自動保留先前貼圖，初始貼圖亦有 dragon.png 回退。
    if (this.petSave.pet?.type === 'dragon' && this.textures.exists('dragon_anim_00')) {
      const phase = airborne ? 'jump' : (speedRatio > 0.16 ? 'run' : 'idle')
      const frame = justLanded ? 14 : phase === 'jump'
        ? (this.petVelocityY < -120 ? 11 : this.petVelocityY > 130 ? 13 : 12)
        : phase === 'run'
          ? 5 + (Math.floor(time / 95) % 5)
          : Math.floor(time / 230) % 5
      const key = `dragon_anim_${String(frame).padStart(2, '0')}`
      if (frame !== this.dragonAnimIndex && this.textures.exists(key)) {
        this.petSprite.setTexture(key)
        this.dragonAnimIndex = frame
      }
    }
    // 保留原本的腳步、跟隨、落地塵埃與位置修正。
    const step = Math.sin(this.petStride)
    const bob = airborne ? 0 : speedRatio > 0.15 ? Math.abs(step) * 5.2 : Math.sin(time / 440) * 1.2
    this.petSprite.y = this.petFeetY - bob
    this.petSprite.setRotation(airborne ? Phaser.Math.Clamp(this.petVelocityY / 4100, -0.09, 0.09)
      : step * speedRatio * 0.043)
    const stretch = airborne ? 1.035 : 1 + speedRatio * Math.sin(this.petStride * 2) * 0.023
    this.petSprite.setDisplaySize(91 / stretch, 91 * stretch)
    this.petShadow.setPosition(this.petSprite.x, landingY + 2)
    this.petShadow.setAlpha(airborne ? 0.12 : 0.24)
    this.petShadow.setScale(airborne ? 0.72 : 1)
    this.petNameLabel.setPosition(this.petSprite.x, this.petSprite.y - this.petSprite.displayHeight - 16)
    if (!airborne && speedRatio > 0.4 && time - this.petLastDustAt > 220) {
      this.petFootstep(this.petSprite.x, this.petFeetY)
      this.petLastDustAt = time
    }
  }

  createFeedingPanel() {
    this.feedUI = []
    const panel = this.add.rectangle(995, 239, 374, 236, 0x142b44, 0.91)
      .setScrollFactor(0).setDepth(101).setStrokeStyle(2, 0xe7cb88, 0.8)
    this.feedUI.push(panel)
    const title = this.fixedText(828, 128, '神寵養成', 21).setDepth(102)
    this.feedUI.push(title)
    this.feedSummary = this.fixedText(828, 163, '', 15).setDepth(102)
    this.feedSummary.setWordWrapWidth(330)
    this.feedUI.push(this.feedSummary)
    this.foodButtons = {}
    FOOD_TYPES.forEach((item, i) => {
      const b = this.add.text(828 + (i % 2) * 167, 229 + Math.floor(i / 2) * 43,
        '', { fontFamily:'Microsoft JhengHei, sans-serif', fontSize:'15px',
          color:'#fff2d1', backgroundColor:'#315c7d', padding:{x:9,y:8} })
        .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor:true })
      b.on('pointerdown', () => this.feedPet(item.id))
      this.foodButtons[item.id] = b
      this.feedUI.push(b)
    })
    this.testFoodButton = this.add.text(828, 316, '領取測試飼料 (+3/+2/+1)',
      { fontFamily:'Microsoft JhengHei, sans-serif', fontSize:'14px', color:'#fff0c2',
        backgroundColor:'#3e6050', padding:{x:10,y:7} })
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor:true })
    this.testFoodButton.on('pointerdown', () => this.giveTestFood())
    this.feedUI.push(this.testFoodButton)
    this.awakenButton = this.add.text(828, 351, '進行品階覺醒 (需 100 飽食度)',
      { fontFamily:'Microsoft JhengHei, sans-serif', fontSize:'14px', color:'#fff6e1',
        backgroundColor:'#735292', padding:{x:9,y:8} })
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor:true })
    this.awakenButton.on('pointerdown', () => this.awakenPet())
    this.feedUI.push(this.awakenButton)
    this.refreshFeedingPanel()
  }

  refreshFeedingPanel() {
    if (!this.feedSummary) return
    const save = this.petSave
    const pet = save.pet
    this.feedSummary.setText(pet
      ? `飽食度：${pet.hunger || 0}/100  ·  覺醒次數：${save.awakenings}
最高品階：${pet.rarity}`
      : '領取並孵化寵物蛋後，即可餵食與覺醒。')
    for (const item of FOOD_TYPES) {
      this.foodButtons[item.id].setText(`${item.name} +${item.value} ×${save.food[item.id]}`)
    }
    this.awakenButton.setAlpha(pet && (pet.hunger || 0) >= 100 ? 1 : 0.55)
  }

  giveTestFood() {
    // 這是開發階段的測試補給，正式版會改成打怪、任務與寶箱掉落。
    const add = { basic: 3, fresh: 2, fruit: 1 }
    for (const id of Object.keys(add)) this.petSave.food[id] += add[id]
    this.savePet()
    this.refreshFeedingPanel()
    this.inventory?.refresh()
    this.showNotice('已領取開發測試用飼料！')
  }

  feedPet(id) {
    const pet = this.petSave.pet
    const item = FOOD_TYPES.find(f => f.id === id)
    if (!pet || !item) { this.showNotice('請先取得寵物！'); return }
    if ((pet.hunger || 0) >= 100) { this.showNotice('飽食度已滿，請先覺醒！'); return }
    if (!this.petSave.food[id]) { this.showNotice(`${item.name} 數量不足`); return }
    this.petSave.food[id] -= 1
    pet.hunger = Math.min(100, (pet.hunger || 0) + item.value)
    this.savePet()
    this.refreshPetHud()
    this.refreshFeedingPanel()
    this.inventory?.refresh()
    this.showNotice(`餵食 ${item.name}！飽食度 ${pet.hunger}/100`)
  }

  awakenPet() {
    const pet = this.petSave.pet
    if (!pet) { this.showNotice('請先孵化寵物！'); return }
    if ((pet.hunger || 0) < 100) { this.showNotice('飽食度必須達到 100 才能覺醒！'); return }
    const result = rollRarity()
    const oldIndex = RARITIES.findIndex(r => r.name === pet.rarity)
    const newIndex = RARITIES.findIndex(r => r.name === result.name)
    const upgraded = newIndex > oldIndex
    if (upgraded) pet.rarity = result.name
    pet.hunger = 0
    this.petSave.awakenings++
    this.savePet()
    this.spawnOwnedPet()
    this.refreshPetHud()
    this.refreshFeedingPanel()
    this.showNotice(upgraded
      ? `覺醒成功！品階提升為【${pet.rarity}】！`
      : `覺醒抽中【${result.name}】，保留原本最高品階【${pet.rarity}】`)
  }

  addPlatform(x, y, width) {
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(0x523824, 0.32).fillRoundedRect(x-width/2+5, y+7, width, 15, 6)
    g.fillStyle(0xa77343).fillRoundedRect(x-width/2, y-5, width, 16, 5)
    g.fillStyle(0xe7bb7c).fillRoundedRect(x-width/2+3, y-5, width-6, 5, 3)
    for(let j=x-width/2+22;j<x+width/2;j+=29) g.lineStyle(2, 0x805635).lineBetween(j,y,j,y+10)
    const p = this.platforms.create(x, y+3, 'solid').setVisible(false)
    p.setDisplaySize(width, 15).refreshBody()
  }

  addNpc(npc) {
    // Use separate transparent artwork; feet align to FLOOR_Y.
    // NPCs are static scenery actors, so they do not modify the player's physics body.
    const s = this.add.image(npc.x, FLOOR_Y, npc.art)
      .setOrigin(0.5, 1).setDepth(23)
    s.setDisplaySize(npc.height * s.width / s.height, npc.height)
    npc.sprite = s
    const nameY = FLOOR_Y - npc.height - 15
    this.add.text(npc.x, nameY, npc.name, {
      fontFamily:'Microsoft JhengHei, sans-serif',fontSize:'19px',fontStyle:'bold',color:'#fff9e6',
      stroke:'#233e53',strokeThickness:5
    }).setOrigin(0.5).setDepth(25)
    this.add.text(npc.x, nameY - 38, '!', {
      fontFamily:'Arial',fontSize:'31px',fontStyle:'bold',color:'#ffe582',stroke:'#4a3b35',strokeThickness:6
    }).setOrigin(0.5).setDepth(25)
  }

  addPortal(portal) {
    const g = this.add.graphics().setDepth(13)
    g.lineStyle(7, 0xffde98, 0.92).strokeRoundedRect(portal.x-37,FLOOR_Y-115,74,113,30)
    g.fillStyle(0x6ddce4,0.22).fillRoundedRect(portal.x-30,FLOOR_Y-108,60,98,25)
    g.lineStyle(2,0xa7efff,0.65).strokeRoundedRect(portal.x-28,FLOOR_Y-106,56,94,25)
    this.add.text(portal.x,FLOOR_Y-146,portal.name,{
      fontFamily:'Microsoft JhengHei, sans-serif',fontSize:'20px',fontStyle:'bold',color:'#fff5c8',
      stroke:'#263e62',strokeThickness:5
    }).setOrigin(.5).setDepth(14)
    this.tweens.add({targets: g, alpha:0.73, duration:850, yoyo:true, repeat:-1})
  }

  fixedText(x,y,txt,size=18) {
    return this.add.text(x,y,txt,{fontFamily:'Microsoft JhengHei, sans-serif',fontSize:`${size}px`,
      fontStyle:'bold',color:'#fff9e9',stroke:'#18324a',strokeThickness:4})
      .setScrollFactor(0).setDepth(100)
  }

  // Alpha 0.6.8 — 原創經典橫向 MMORPG UI（佈局參考，非複製其他遊戲素材）
  createHud() {
    const font = 'Microsoft JhengHei, sans-serif'
    const T = (x, y, text, size = 14, color = '#f8f1dd', depth = 111) =>
      this.add.text(x, y, text, {fontFamily:font,fontSize:`${size}px`,color,
        fontStyle:'bold',stroke:'#192334',strokeThickness:3})
        .setScrollFactor(0).setDepth(depth)
    const rect = (x,y,w,h,fill,alpha=1,depth=105,stroke=0,strokeAlpha=1,radius=0) => {
      const obj = radius ? this.add.graphics().setScrollFactor(0).setDepth(depth) :
        this.add.rectangle(x,y,w,h,fill,alpha).setOrigin(0).setScrollFactor(0).setDepth(depth)
      if (radius) {
        obj.fillStyle(fill,alpha).fillRoundedRect(x,y,w,h,radius)
        if (stroke) obj.lineStyle(2,stroke,strokeAlpha).strokeRoundedRect(x,y,w,h,radius)
      } else if (stroke) obj.setStrokeStyle(2,stroke,strokeAlpha)
      return obj
    }
    // 迷你地圖：名稱、世界長街縮圖、定位點，M 可收起。
    this.miniParts = []
    this.miniParts.push(rect(13,11,241,143,0x10253a,.91,107,0xe8c987,.94,9))
    this.miniParts.push(rect(18,16,231,28,0x264967,1,108,0,1,5))
    this.miniParts.push(T(28,20,'晨曦村  ·  神寵大陸',16,'#ffe3a4'))
    this.miniParts.push(T(225,23,'[M]',12,'#b2e9ff'))
    const mini = this.add.graphics().setScrollFactor(0).setDepth(109)
    mini.fillStyle(0x6ea980).fillRoundedRect(24,51,218,84,5)
    mini.fillStyle(0x9ed0a2).fillRoundedRect(26,68,214,50,5)
    mini.fillStyle(0xc2b28c).fillRoundedRect(27,91,212,9,2)
    mini.fillStyle(0x386f9c).fillRoundedRect(46,70,24,22,3)
    mini.fillStyle(0xe0d3a2).fillCircle(119,87,13)
    mini.fillStyle(0x386f9c).fillRoundedRect(167,70,26,22,3)
    mini.lineStyle(2,0xf8e1a5).strokeRoundedRect(24,51,218,84,5)
    this.miniParts.push(mini)
    this.miniPlayer = this.add.circle(60,95,5,0xffe45e).setScrollFactor(0).setDepth(111).setStrokeStyle(2,0x17263a)
    this.miniParts.push(this.miniPlayer)
    this.miniParts.push(T(28,137,'MAP 01    新手區',11,'#dae7d6'))

    // 底座具有陰影、金邊及不同功能分區；遊戲畫面仍是主體。
    rect(0,574,1200,101,0x0e1e33,.94,104)
    rect(0,574,1200,3,0xe3c486,.95,106)
    rect(0,582,1200,1,0x667e97,.7,106)
    rect(12,588,332,75,0x203c56,.97,106,0x9eb2c5,.45,8)
    this.add.circle(57,622,31,0x19324e).setScrollFactor(0).setDepth(108).setStrokeStyle(2,0xe8cd8a)
    this.hudPortrait = this.add.image(57,627,this.jobTexture('idle')).setDisplaySize(45,56).setScrollFactor(0).setDepth(110)
    this.characterTitle = T(94,591,'Lv. 1  新手冒險者',14,'#ffe2a4')
    const bar = (x,y,w,fill,label) => {
      rect(x,y,w,12,0x102235,.95,108,0x8fa4be,.5,3)
      rect(x+2,y+2,w-4,8,fill,1,109,0,1,2)
      return T(x+8,y-1,label,11,'#ffffff',110)
    }
    bar(98,614,224,0xce4e67,'HP   100 / 100')
    this.mpLabel = bar(98,636,224,0x3691d9,'MP   100 / 100  (預留)')
    T(18,657,'EXP 0.0%',10,'#e7e0c8')
    rect(100,658,222,5,0x101c2e,1,109)
    rect(100,658,3,5,0xf8d16d,1,110)

    // 中間快捷欄：只有已完成的功能會操作，未完成者顯示提示。
    const menu = [
      {key:'I',text:'背包',symbol:'▣',color:0x6b9ad1,action:()=>this.inventory.toggle()},
      {key:'C',text:'角色',symbol:'♙',color:0x86b7dd,action:()=>this.characterUI.toggle()},
      {key:'P',text:'神寵',symbol:'✦',color:0xedb65c,action:()=>this.toggleFeedingPanel()},
      {key:'Q',text:'任務',symbol:'▤',color:0x8bc18e,action:()=>this.showNotice('任務系統開發中')},
      {key:'S',text:'技能',symbol:'✧',color:0xb7a2e5,action:()=>this.spiritSkills?.toggle()}
    ]
    rect(353,587,429,77,0x1a344e,.98,106,0x8cabbc,.55,8)
    menu.forEach((item,i)=>{
      const x=367+i*82
      const bg=rect(x,595,72,61,0x264760,1,108,0xc4ac75,.7,6)
      const hit=this.add.zone(x+36,625,72,61).setScrollFactor(0).setDepth(114)
        .setInteractive({useHandCursor:true})
      hit.on('pointerdown',()=>{if(!this.dialogOpen && !this.characterUI?.isBlocking())item.action()})
      T(x+25,595,item.symbol,22,`#${item.color.toString(16).padStart(6,'0')}`)
      T(x+16,621,item.text,13,'#f9f0d5')
      T(x+29,642,item.key,11,'#c1d8ed')
    })

    // 右邊模擬經典 MMORPG 快捷格，數字按鍵目前尚未綁定道具。
    rect(796,587,391,77,0x1b344e,.98,106,0x8cabbc,.55,8)
    T(810,590,'快捷欄',11,'#e5c894')
    const slots=[['1','○'],['2','✦'],['3','◇'],['4','☆'],['5','♡'],['6','△'],['7','▣'],['8','+']]
    slots.forEach(([key,symbol],i)=>{
      const x=805+i*47
      rect(x,609,42,44,0x10283e,1,108,0x9caec5,.7,5)
      T(x+12,611,symbol,17,i<2?'#e5c48c':'#829cb4')
      T(x+31,638,key,10,'#d8dfe8')
    })
    // 輕量提示與對話相容；各式養成 UI 仍透過 P 開關。
    this.petHud = T(806,554,'',12,'#fff3c8')
    this.hatchButton=this.add.text(1035,546,'孵化 [H]',{fontFamily:font,fontSize:'14px',
      color:'#fff0bf',backgroundColor:'#2d516e',padding:{x:7,y:5}})
      .setScrollFactor(0).setDepth(115).setInteractive({useHandCursor:true}).setVisible(false)
    this.hatchButton.on('pointerdown',()=>{if(!this.dialogOpen)this.hatchEgg()})
    this.coords = T(13,552,'',12,'#f0f0df')
    this.near = T(WIDTH/2,540,'',17,'#fff1c5').setOrigin(.5)
    this.panel=this.add.rectangle(600,475,850,166,0x172d44,.97)
      .setScrollFactor(0).setDepth(140).setStrokeStyle(3,0xe5c88b).setVisible(false)
    this.dialog=T(210,409,'',21).setDepth(141).setVisible(false)
    this.dialog.setWordWrapWidth(770)
    this.hint=T(966,533,'E / ESC 關閉',15).setDepth(142).setVisible(false)
  }

  toggleFeedingPanel(force) {
    const visible = typeof force === 'boolean' ? force : !this.feedingOpen
    this.feedingOpen = visible
    for (const el of this.feedUI || []) el.setVisible(visible)
    if (visible) this.refreshFeedingPanel()
  }

  getNearby() {
    let found = null
    for (const npc of this.npcs) {
      const d = Math.abs(this.player.x-npc.x)
      if (d<100 && (!found || d<found.d)) found={obj:npc,type:'npc',d}
    }
    for (const portal of this.portals) {
      const d = Math.abs(this.player.x-portal.x)
      if (d<90 && (!found || d<found.d)) found={obj:portal,type:'portal',d}
    }
    return found
  }

  interact() {
    if (this.characterUI?.isBlocking()) return
    if (this.dialogOpen) { this.closeDialog(); return }
    const nearby = this.getNearby()
    if (!nearby) return
    this.dialogOpen = true
    this.panel.setVisible(true)
    const message = nearby.type === 'npc' && nearby.obj.name === '寵物學者'
      ? this.receiveEgg() : nearby.obj.line
    this.dialog.setText(`${nearby.obj.name}\n\n${message}`).setVisible(true)
    this.hint.setVisible(true)
  }

  closeDialog() {
    this.dialogOpen = false
    this.panel.setVisible(false)
    this.dialog.setVisible(false)
    this.hint.setVisible(false)
  }

  update(time, delta) {
    if (!this.player?.body) return
    const dt = Math.min(delta / 1000, 0.05)
    const left = this.keybinds.isDown('left') || this.keybinds.isDown('left2')
    const right = this.keybinds.isDown('right') || this.keybinds.isDown('right2')
    const jumpDown = this.keybinds.isDown('jump') || this.keybinds.isDown('jump2') || this.keybinds.isDown('jump3')
    const controlsBlocked = this.dialogOpen || this.inventory?.open || this.characterUI?.isBlocking() || this.wardrobe?.open || this.equipment?.open || this.keybinds.open
    const dir = controlsBlocked ? 0 : Number(right) - Number(left)
    const grounded = this.player.body.blocked.down || this.player.body.touching.down
    if (grounded) this.lastGroundedAt = time
    if (jumpDown && !this.wasJumpDown && !controlsBlocked) this.lastJumpPressedAt = time
    const acc = grounded ? MOVE.groundAcceleration : MOVE.airAcceleration
    const brake = grounded ? MOVE.groundFriction : MOVE.airDrag
    const velocityX = this.player.body.velocity.x
    const targetX = dir * MOVE.maxSpeed
    const step = (dir === 0 ? brake : acc) * dt
    this.player.setVelocityX(controlsBlocked ? 0 : approach(velocityX, targetX, step))
    if (dir !== 0) this.player.setFlipX(dir < 0)

    const canJump = grounded || time - this.lastGroundedAt < MOVE.coyoteTimeMs
    const buffered = time - this.lastJumpPressedAt < MOVE.jumpBufferMs
    if (!controlsBlocked && buffered && canJump) {
      this.player.setVelocityY(-MOVE.jumpSpeed)
      this.lastJumpPressedAt = -9999
      this.lastGroundedAt = -9999
    }
    // 鬆開跳躍鍵，縮短尚未完成的上升速度，形成可控制的跳躍高度。
    if (!jumpDown && this.wasJumpDown && this.player.body.velocity.y < -80)
      this.player.setVelocityY(this.player.body.velocity.y * MOVE.jumpCutRatio)
    this.wasJumpDown = jumpDown

    const speed = Math.abs(this.player.body.velocity.x)
    const moving = speed > 25
    // 同一職業各影格已統一 200×248 畫布與底部基準。
    // 跑步按實際位移推進，而非按時間空轉；加速時自然增加步頻。
    if (moving && grounded) {
      if (!this.wasMovingForAnim) this.runCycleTravel = 0
      this.runCycleTravel += speed * dt
    } else if (!moving) {
      this.runCycleTravel = 0
    }
    if (moving !== this.wasMovingForAnim) this.idleAnimStartedAt = time
    this.wasMovingForAnim = moving
    if (grounded && !this.wasGrounded) this.landingUntil = time + 105
    this.wasGrounded = grounded
    const basePose = !grounded ? 'jump' : !moving ? 'idle' :
      (Math.floor(this.runCycleTravel / 33) % 2 === 0 ? 'run1' : 'run2')
    const runFrame = Math.floor(this.runCycleTravel / 25) % 6
    const idleFrame = Math.floor((time - this.idleAnimStartedAt) / 420) % 3
    const motion = !grounded ? (this.player.body.velocity.y > 70 ? 'fall' : 'jump')
      : time < this.landingUntil ? 'land'
      : !moving ? `idle${idleFrame}` : `run${runFrame}`
    const motionTexture = this.activeJobId ? `motion_${this.activeJobId}_${motion}` : null
    const texture = motionTexture && this.textures.exists(motionTexture) ? motionTexture : this.jobTexture(basePose)
    if (this.player.texture.key !== texture) {
      // 只切圖，不改物理 body、速度、玩家座標、存檔與服裝設定。
      this.player.setTexture(texture)
      this.player.setDisplaySize(94,116)
      // 維持原版已驗收的碰撞框；避免換圖導致腳底與地面錯位。
      this.player.body.setSize(90,190).setOffset(55,48)
    }
    this.player.lastPose = basePose
    this.wardrobe?.update()
    this.equipment?.update()
    this.spiritLayers?.update(motion)
    this.spiritWardrobeV2?.update(motion)
    this.playerShadow.setPosition(this.player.x, this.player.body.bottom + 1)
    this.playerShadow.setAlpha(grounded ? 0.21 : 0.09)
    this.playerShadow.setScale(grounded ? 1 : 0.7)
    this.coords.setText(`X: ${Math.round(this.player.x)}  Y: ${Math.round(this.player.y)}  |  地圖 01 晨曦村`)
    // 迷你地圖標記會依玩家位置更新。
    if (this.miniPlayer) this.miniPlayer.x = 27 + Phaser.Math.Clamp(this.player.x / WORLD_WIDTH, 0, 1) * 212
    this.updatePet(time, delta)
    const near = this.getNearby()
    this.near.setText(controlsBlocked ? '' : (near ? `按 E 與「${near.obj.name}」互動` : ''))
  }

}

new Phaser.Game({
  type: Phaser.AUTO,
  parent:'app',
  width:WIDTH,height:HEIGHT,
  backgroundColor:'#80c9f7',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  physics:{default:'arcade',arcade:{gravity:{y:MOVE.gravity},debug:false}},
  scene:[Village]
})
