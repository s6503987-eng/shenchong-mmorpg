// 《神寵》Alpha 1.0.1 — 御靈師 8 張手部施法逐格動畫
// 唯一替換 basic_attack.js；保留 KeybindSystem 設定、AP 加成、木樁與 EXP 掉落判定。
// 角色動畫使用原角色的縮放/微傾，不額外黏貼裝備圖片或替換人物貼圖。
export const SPIRIT_ATTACK=Object.freeze({
  key:'J',cooldownMs:430,chainWindowMs:950,projectileSpeed:580,
  projectileRange:460,projectileRadius:12,hitRadius:34,
  dummyMaxHp:180,respawnMs:2200,damage1:15,damage2:20,
  windupMs:125,recoverMs:300
});
export function projectileCrossesTarget(x0,x1,y,targetX,targetY,radius=34){
  return targetX>=Math.min(x0,x1)-radius&&targetX<=Math.max(x0,x1)+radius&&Math.abs(targetY-y)<=radius+13;
}
export function nextCombo(lastAttackAt,now,lastCombo,windowMs=SPIRIT_ATTACK.chainWindowMs){
  return now-lastAttackAt<=windowMs&&lastCombo===1?2:1;
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>1-Math.pow(1-clamp(t),3);
export function castMotion(elapsed,windup=125,duration=300){
  if(elapsed<0||elapsed>=duration)return {active:false,lean:0,squash:0,glow:0};
  if(elapsed<windup){const t=ease(elapsed/windup);return {active:true,lean:-4*t,squash:.058*t,glow:t};}
  const t=(elapsed-windup)/(duration-windup);return {active:true,lean:7*Math.exp(-7*t)-2*Math.sin(Math.PI*t),squash:-.038*Math.exp(-6*t),glow:1-t};
}
export class BasicAttackSystem{
  constructor(scene,options={}){
    this.scene=scene;this.opts={...SPIRIT_ATTACK,...options};
    this.bolts=[];this.particles=[];this.cast=null;this.combo=0;this.lastAttackAt=-Infinity;
    this.dead=false;this.hp=this.opts.dummyMaxHp;
    this.dummyX=Math.min(Math.max((scene.player?.x??570)+230,410),1050);
    this.dummyY=432;
    this.dummy=this.makeDummy();
    this.refresh(); // 先建木樁再刷新，防止 0.9.6 舊版初始化錯誤
    this.fx=scene.add.graphics().setDepth(42);
    this.hint=scene.add.text(16,608,'御靈師：普通攻擊＝蓄力 → 靈紋施法 → 靈刃飛行 → 命中爆發',{fontFamily:'Microsoft JhengHei, sans-serif',fontSize:'13px',color:'#d6faff',stroke:'#153449',strokeThickness:4}).setScrollFactor(0).setDepth(140);
    this.keyFn=e=>{if(e?.repeat||e?.altKey||e?.ctrlKey||e?.metaKey)return;this.attack();};
    // 兼容 0.9.9+ 玩家自訂快捷鍵，也兼容只有 J 的舊版
    this.boundByKeybind=!!scene.keybinds?.register;
    if(this.boundByKeybind)scene.keybinds.register('attack',this.keyFn);
    else scene.input.keyboard?.on('keydown-'+this.opts.key,this.keyFn);
    this.updateFn=(_time,delta)=>this.update(delta);
    this.postFn=()=>this.postUpdate();
    scene.events.on('update',this.updateFn);
    scene.events.on('postupdate',this.postFn);
    scene.events.once('shutdown',()=>this.destroy());
  }
  isSpirit(){return (this.scene.activeJobId||this.scene.characterUI?.data?.jobId)==='spirit';}
  blocked(){const s=this.scene;return !!(s.dialogOpen||s.inventory?.open||s.characterUI?.isBlocking?.()||s.wardrobe?.open||s.equipment?.open||s.feedingOpen||s.keybinds?.open||s.stats?.open||s.progression?.open);}
  makeDummy(){
    const s=this.scene,c=s.add.container(this.dummyX,this.dummyY).setDepth(23);
    const g=s.add.graphics();g.fillStyle(0x67432b).fillRoundedRect(-20,-50,40,63,6);g.lineStyle(4,0xd1a26a).strokeRoundedRect(-20,-50,40,63,6);
    g.fillStyle(0xb68a58).fillRect(-24,-27,48,10);g.fillStyle(0x563b29).fillRect(-8,13,16,20);
    g.lineStyle(2,0xe7c99b).strokeCircle(0,-20,11);g.lineBetween(-11,-20,11,-20);g.lineBetween(0,-31,0,-9);
    this.hpText=s.add.text(0,-74,'',{fontFamily:'Microsoft JhengHei',fontSize:'13px',color:'#fff2cf',stroke:'#192f47',strokeThickness:3}).setOrigin(.5);
    this.hpBar=s.add.rectangle(-31,-60,62,5,0x68e7c6).setOrigin(0,.5);
    const label=s.add.text(0,-97,'訓練木樁',{fontFamily:'Microsoft JhengHei',fontSize:'14px',color:'#fff5d3',stroke:'#192f47',strokeThickness:3}).setOrigin(.5);
    c.add([g,label,this.hpText,s.add.rectangle(0,-60,68,9,0x1f3047).setOrigin(.5),this.hpBar]);return c;
  }
  refresh(){this.hpText.setText(`${Math.max(0,this.hp)} / ${this.opts.dummyMaxHp}`);this.hpBar.setScale(Math.max(0,this.hp)/this.opts.dummyMaxHp,1);this.dummy.setAlpha(this.dead?.28:1);}
  attack(){
    const s=this.scene,p=s.player;
    if(!p?.active||!this.isSpirit()||this.blocked())return false;
    const now=s.time.now;if(now-this.lastAttackAt<this.opts.cooldownMs)return false;
    this.combo=nextCombo(this.lastAttackAt,now,this.combo,this.opts.chainWindowMs);
    this.lastAttackAt=now;
    this.cast={at:now,dir:p.flipX?-1:1,combo:this.combo,launched:false};
    // 蓄能星光：不是把另一張服裝圖疊到角色上
    this.emit(p.x+(p.flipX?-25:25),p.y-20,this.combo===2?0xffd78b:0x80eaff,11,85);
    return true;
  }
  emit(x,y,color,count=10,speed=140){
    for(let i=0;i<count;i++){
      const theta=(i/count)*Math.PI*2+(i%3)*.14;
      const v=speed*(.65+(i%4)*.12);
      this.particles.push({x,y,vx:Math.cos(theta)*v,vy:Math.sin(theta)*v,age:0,life:230+(i%4)*70,r:1.5+(i%3),color});
    }
    if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);
  }
  launch(c){
    const s=this.scene,p=s.player;if(!p?.active)return;
    const dir=c.dir,combo=c.combo;
    const x=p.x+dir*42,y=p.y-19;
    // 靈力彈變成「靈刃＋殘影＋旋轉法環」，與角色施法形成完整一招
    this.bolts.push({x,y,dir,travel:0,combo,age:0,trail:[],hit:false});
    this.emit(x,y,combo===2?0xffd589:0x65eaff,15,175);
  }
  update(delta){
    const s=this.scene;if(!s.player?.active)return;
    const dt=Math.min(Math.max(delta||0,0),50)/1000;
    if(this.cast&&!this.cast.launched&&s.time.now-this.cast.at>=this.opts.windupMs){this.cast.launched=true;this.launch(this.cast);}
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i],prior=b.x,move=this.opts.projectileSpeed*dt*b.dir;
      b.x+=move;b.travel+=Math.abs(move);b.age+=dt;
      b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>8)b.trail.pop();
      if(!this.dead&&projectileCrossesTarget(prior,b.x,b.y,this.dummyX,this.dummyY-19,this.opts.hitRadius)){
        this.damageDummy(b);this.bolts.splice(i,1);continue;
      }
      if(b.travel>=this.opts.projectileRange||b.x<0||b.x>2400)this.bolts.splice(i,1);
    }
    for(let i=this.particles.length-1;i>=0;i--){const q=this.particles[i];q.age+=delta;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.95;q.vy*=.95;if(q.age>=q.life)this.particles.splice(i,1);}
  }
  // 在 main.update 之後，為原角色加上蓄力前傾/後坐/回正的連續動作。
  postUpdate(){
    const s=this.scene,p=s.player;
    if(!p?.active)return;
    const fx=this.fx;fx.clear();
    const c=this.cast;
    const elapsed=c?s.time.now-c.at:Infinity;
    const m=castMotion(elapsed,this.opts.windupMs,this.opts.recoverMs);
    // 角色逐格動畫：由「施法動作圖」控制真正的手臂姿勢，僅攻擊期間取代人物 Texture。
    // main.js 的一般待機/跑跳貼圖每幀照常執行；不改人物碰撞、位置和背包裝備。
    if(this.isSpirit()){
      if(m.active){
        const frame=Math.min(7,Math.max(0,Math.floor(elapsed/this.opts.recoverMs*8)));
        const texture=`sc101_spirit_cast_${frame}`;
        if(s.textures.exists(texture)){
          if(p.texture.key!==texture)p.setTexture(texture);
          p.setAngle(0);
          p.setDisplaySize(94,116);
          this.spritePoseActive=true;
        }else{ // 遺漏 PNG 時，回退原先的柔和施法動態，不會造成整個遊戲停止回應
          p.setAngle(m.lean*c.dir);
          p.setDisplaySize(94*(1+m.squash),116*(1-m.squash*.6));
          this.spritePoseActive=false;
        }
      } else if(this.poseApplied){
        p.setAngle(0);p.setDisplaySize(94,116);
        this.spritePoseActive=false;
      }
      this.poseApplied=m.active;
    }
    if(c&&m.active){
      const dir=c.dir,handX=p.x+dir*(23+12*m.glow),handY=p.y-24;
      const color=c.combo===2?0xffd68d:0x7de8ff;
      const r=13+15*m.glow;
      // 魔法陣主圓、內部六芒星、旋轉符紋；非靜態貼圖
      fx.lineStyle(2,color,clamp(m.glow*.95)).strokeCircle(handX,handY,r);
      fx.lineStyle(1,0xffffff,clamp(m.glow*.65)).strokeCircle(handX,handY,r*.68);
      const spin=elapsed*.012;
      for(let n=0;n<6;n++){
        const a=spin+n*Math.PI/3,b=spin+(n+2)*Math.PI/3;
        fx.lineStyle(1.5,color,clamp(m.glow*.8));
        fx.lineBetween(handX+Math.cos(a)*r,handY+Math.sin(a)*r,handX+Math.cos(b)*r,handY+Math.sin(b)*r);
      }
      for(let n=0;n<8;n++){const a=-spin*.7+n*Math.PI/4;fx.fillStyle(0xffffff,clamp(m.glow*.8));fx.fillCircle(handX+Math.cos(a)*(r+6),handY+Math.sin(a)*(r+6),1.8);}
    }
    if(c&&elapsed>=this.opts.recoverMs){this.cast=null;}
    for(const b of this.bolts){
      const col=b.combo===2?0xffce72:0x6de9ff;
      for(let j=b.trail.length-1;j>=0;j--){const t=b.trail[j],fade=1-j/b.trail.length;
        fx.fillStyle(col,fade*.16);fx.fillEllipse(t.x,t.y,30*fade+4,12*fade+4);
      }
      const theta=b.age*18;
      fx.lineStyle(2,0xffffff,.85).strokeEllipse(b.x,b.y,27,17);
      fx.fillStyle(col,.82).fillEllipse(b.x,b.y,38,13);
      fx.fillStyle(0xffffff,.95).fillEllipse(b.x+b.dir*4,b.y,21,6);
      for(let n=0;n<3;n++){const a=theta+n*2*Math.PI/3;fx.fillStyle(col,.9).fillCircle(b.x+Math.cos(a)*14,b.y+Math.sin(a)*13,3);}
      fx.lineStyle(2,col,.75).lineBetween(b.x-b.dir*15,b.y,b.x-b.dir*38,b.y);
    }
    for(const q of this.particles){fx.fillStyle(q.color,clamp(1-q.age/q.life));fx.fillCircle(q.x,q.y,q.r);}
  }
  damageDummy(b){
    const s=this.scene;
    const amount=b.combo===2?this.opts.damage2:this.opts.damage1;
    this.hp=Math.max(0,this.hp-amount);
    // 震盪光環 + 散射碎光 + 木樁輕微震動
    const col=b.combo===2?0xffd078:0x8ceeff;
    this.emit(this.dummyX,this.dummyY-20,col,22,210);
    const ring=s.add.circle(this.dummyX,this.dummyY-20,12).setStrokeStyle(4,col,.95).setDepth(45);
    s.tweens.add({targets:ring,scale:5,alpha:0,duration:280,onComplete:()=>ring.destroy()});
    s.tweens.add({targets:this.dummy,x:this.dummyX+(b.dir*7),duration:55,yoyo:true,repeat:1,onComplete:()=>{if(this.dummy?.active)this.dummy.x=this.dummyX;}});
    const txt=s.add.text(this.dummyX,this.dummyY-111,`-${amount}`,{fontFamily:'Arial',fontSize:'25px',fontStyle:'bold',color:b.combo===2?'#ffe49c':'#c1f5ff',stroke:'#284c70',strokeThickness:4}).setOrigin(.5).setDepth(50);
    s.tweens.add({targets:txt,y:txt.y-38,alpha:0,duration:700,onComplete:()=>txt.destroy()});
    this.refresh();
    if(this.hp===0){this.dead=true;this.refresh();s.showNotice?.('御靈師擊破訓練木樁！');this.respawn?.remove(false);
      this.respawn=s.time.delayedCall(this.opts.respawnMs,()=>{this.hp=this.opts.dummyMaxHp;this.dead=false;this.refresh();});}
  }
  destroy(){
    const s=this.scene;
    if(this.boundByKeybind)s.keybinds?.unregister('attack',this.keyFn);
    else s.input.keyboard?.off('keydown-'+this.opts.key,this.keyFn);
    s.events.off('update',this.updateFn);s.events.off('postupdate',this.postFn);
    this.respawn?.remove(false);
    if(this.poseApplied&&s.player?.active){s.player.setAngle(0);s.player.setDisplaySize(94,116);}
    this.bolts=[];this.particles=[];this.fx?.destroy();this.dummy?.destroy();this.hint?.destroy();
  }
}
