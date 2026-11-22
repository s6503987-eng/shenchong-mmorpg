import test from 'node:test';
import assert from 'node:assert/strict';
import { expToNext, addExperience, MAX_LEVEL, eligibleRank } from '../src/progression.js';
import {computeStats} from '../src/attributes.js';
import {STAGES, canAdvance, nextStage} from '../src/spirit_advancement.js';
import {SKILLS, learnSkill, availableSP, skillDamage} from '../src/spirit_skills.js';
import {DEFAULT_BINDINGS, validateBindings} from '../src/keybinds.js';

test('200級封頂與經驗升級',()=>{
 assert.equal(MAX_LEVEL,200);
 assert.equal(expToNext(200),0);
 assert.equal(addExperience(1,0,expToNext(1)).level,2);
 assert.deepEqual([10,30,60,100,150].map(eligibleRank),[1,2,3,4,5]);
});
test('200級AP自動成長和分配',()=>{
 const base={STR:4,DEX:6,INT:9,LUK:8};
 const a=computeStats(base,{STR:0,DEX:0,INT:0,LUK:0},10);
 assert.equal(a.freeAP,45);assert.equal(a.level,10);assert.ok(a.mpMax>85);
 const b=computeStats(base,{STR:0,DEX:0,INT:45,LUK:0},10);
 assert.equal(b.freeAP,0);assert.ok(b.magicBonus>a.magicBonus);
 assert.throws(()=>computeStats(base,{STR:9999},10),RangeError);
});
test('五次轉職門檻與連續試煉',()=>{
 assert.deepEqual(STAGES.map(x=>x.level),[1,10,30,60,100,150]);
 for(let rank=0;rank<5;rank++){
  const next=nextStage(rank);
  assert.equal(canAdvance(next.level-1,rank,20),false);
  assert.equal(canAdvance(next.level,rank,next.trial-1),false);
  assert.equal(canAdvance(next.level,rank,next.trial),true);
 }
 assert.equal(canAdvance(200,5,999),false);
});
test('技能只能在對應轉職後學習',()=>{
 assert.equal(SKILLS.length,13);
 const map={};
 for(const skill of SKILLS){
  const minRank=skill.stage||0;
  if(minRank>0)assert.equal(learnSkill(skill.level,map,skill.id,minRank-1),null);
  const updated=learnSkill(skill.level,map,skill.id,minRank);
  assert.ok(updated,skill.id);
  assert.equal(updated[skill.id],1);
 }
 assert.equal(availableSP(10,{spirit_burst:10}),0);
 assert.ok(skillDamage('spirit_burst',2,20,4)>skillDamage('spirit_burst',1,0,0));
});
test('自訂按鍵移轉且保留設定入口',()=>{
 assert.equal(DEFAULT_BINDINGS.settings,'TILDE');
 assert.equal(DEFAULT_BINDINGS.advancement,'T');
 for(let n=1;n<=6;n++)assert.equal(DEFAULT_BINDINGS[`skill${n}`],String(n));
 const old={...DEFAULT_BINDINGS};for(const key of ['advancement','skill1','skill2','skill3','skill4','skill5','skill6']) delete old[key];
 old.attack='X';old.left='A';
 const result=validateBindings(old);
 assert.equal(result.attack,'X');assert.equal(result.settings,'TILDE');assert.equal(result.escape,'ESC');
 assert.equal(new Set(Object.values(result)).size,Object.values(result).length);
});
