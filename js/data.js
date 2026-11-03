/* ============================================================
   POKÉBONK · 数据层 v2 —— 对齐 pokebonk.com 玩法骨架
   角色卡（六维种族值/对局属性/职业被动/招式组/R终极技/属性克制/进化链）
   地区（4地区·守护者池·圣地）+ 难度（星星沙子倍率/敌人强化）
   ============================================================ */
(function () {
  'use strict';

  var TYPE_COLORS = {
    normal: '#9099a1', fire: '#ff9d55', water: '#4d90d5', grass: '#63bb5b',
    electric: '#f3d23b', ice: '#75d0c1', fighting: '#ce416b', poison: '#ab6ac8',
    ground: '#d97845', flying: '#8fa8dd', psychic: '#fa7179', bug: '#90c12c',
    rock: '#c7b78b', ghost: '#5269ac', dragon: '#0b6dc3', dark: '#5a5366',
    steel: '#5a8ea1', fairy: '#ec8fe6'
  };
  var TYPE_CN = {
    normal: '一般', fire: '火', water: '水', grass: '草', electric: '电', ice: '冰',
    fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行', psychic: '超能力',
    bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精'
  };

  /* 属性克制表：atk → def → 倍率 */
  var effect = {
    fire: { grass: 2, bug: 2, ice: 2, steel: 2, fire: .5, water: .5, rock: .5, dragon: .5 },
    water: { fire: 2, ground: 2, rock: 2, water: .5, grass: .5, dragon: .5 },
    grass: { water: 2, ground: 2, rock: 2, fire: .5, grass: .5, poison: .5, flying: .5, bug: .5, dragon: .5, steel: .5 },
    electric: { water: 2, flying: 2, grass: .5, electric: .5, dragon: .5, ground: 0 },
    ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: .5, water: .5, ice: .5, steel: .5 },
    fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: .5, flying: .5, psychic: .5, bug: .5, fairy: .5, ghost: 0 },
    poison: { grass: 2, fairy: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0 },
    ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: .5, bug: .5, flying: 0 },
    flying: { grass: 2, fighting: 2, bug: 2, electric: .5, rock: .5, steel: .5 },
    psychic: { fighting: 2, poison: 2, psychic: .5, steel: .5, dark: 0 },
    bug: { grass: 2, psychic: 2, dark: 2, fire: .5, fighting: .5, poison: .5, flying: .5, ghost: .5, steel: .5, fairy: .5 },
    rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: .5, ground: .5, steel: .5 },
    ghost: { psychic: 2, ghost: 2, dark: .5, normal: 0 },
    dragon: { dragon: 2, steel: .5, fairy: 0 },
    dark: { psychic: 2, ghost: 2, fighting: .5, dark: .5, fairy: .5 },
    steel: { ice: 2, rock: 2, fairy: 2, fire: .5, water: .5, electric: .5, steel: .5 },
    fairy: { fighting: 2, dragon: 2, dark: 2, fire: .5, poison: .5, steel: .5 },
    normal: { rock: .5, ghost: 0, steel: .5 }
  };

  /* 招式库：kind = 弹丸 | 连射 | 旋转 | 光束 | 光环
     dmg=基础伤害  cd=冷却(秒)  range=射程(米)  pierce=湮透(0-1)  radius=半径  shots=连射数 */
  var MOVES = {
    /* —— 水 —— */
    watergun:   { name: '水枪',     kind: '弹丸', cat: '特殊', type: 'water', unlockLv: 1, dmg: 18.7, cd: 0.85, range: 19.2, pierce: 0.12, desc: '向最近的敌人发射弹丸。可能造成湿透。' },
    bubble:     { name: '泡沫',     kind: '连射', cat: '特殊', type: 'water', unlockLv: 2, dmg: 7.2, shots: 4, cd: 0.98, range: 18, pierce: 0.12, desc: '发射一轮快速连射的弹丸。可能造成湿透。' },
    rapidspin:  { name: '高速旋转', kind: '旋转', cat: '物理', type: 'water', unlockLv: 4, dmg: 10.7, cd: 0.69, radius: 3.2, desc: '你边旋转边击打，并推开周围所有敌人。' },
    hydropump:  { name: '水炮',     kind: '光束', cat: '特殊', type: 'water', unlockLv: 7, dmg: 13.1, cd: 2.2, range: 14, pierce: 1, desc: '发射一道贯穿一切的持续光束。可能造成湿透。' },
    /* —— 草 —— */
    vinewhip:   { name: '藤鞭',     kind: '弹丸', cat: '物理', type: 'grass', unlockLv: 1, dmg: 16, cd: 0.9, range: 16, pierce: 0, desc: '甩出藤蔓抽打最近的敌人。' },
    razorleaf:  { name: '飞叶快刀', kind: '连射', cat: '特殊', type: 'grass', unlockLv: 2, dmg: 6.5, shots: 4, cd: 1.0, range: 18, pierce: 0.25, desc: '射出锋利的叶片，可穿透敌人。' },
    leechseed:  { name: '寄生种子', kind: '光环', cat: '特殊', type: 'grass', unlockLv: 4, dmg: 5, cd: 2.5, radius: 6, desc: '在身边催生吸血种子，伤害并回复自身。' },
    solarbeam:  { name: '日光束',   kind: '光束', cat: '特殊', type: 'grass', unlockLv: 7, dmg: 22, cd: 3, range: 22, pierce: 1, desc: '凝聚阳光发射贯穿光束。' },
    /* —— 火 —— */
    ember:      { name: '火花',     kind: '弹丸', cat: '特殊', type: 'fire', unlockLv: 1, dmg: 17, cd: 0.8, range: 17, pierce: 0.1, desc: '投出小火苗轰击敌人。可能造成灼伤。' },
    flamewheel: { name: '火焰轮',   kind: '旋转', cat: '物理', type: 'fire', unlockLv: 2, dmg: 12, cd: 1.1, radius: 3.5, desc: '化身火轮碾过周围敌人。可能造成灼伤。' },
    flamethrower:{ name: '喷射火焰', kind: '光束', cat: '特殊', type: 'fire', unlockLv: 4, dmg: 14, cd: 2, range: 16, pierce: 1, desc: '喷出持续火焰烧穿敌人。' },
    fireblast:  { name: '大字爆炎', kind: '弹丸', cat: '特殊', type: 'fire', unlockLv: 7, dmg: 30, cd: 2.8, range: 20, pierce: 0.5, desc: '轰出大字形烈焰，威力巨大。' },
    /* —— 电 —— */
    thundershock:{ name: '电击',    kind: '弹丸', cat: '特殊', type: 'electric', unlockLv: 1, dmg: 14, cd: 0.6, range: 18, pierce: 0.15, desc: '射出电流弹。可能造成麻痹。' },
    quickattack:{ name: '电光一闪', kind: '连射', cat: '物理', type: 'electric', unlockLv: 2, dmg: 10, shots: 3, cd: 0.75, range: 14, pierce: 0, desc: '高速突进连击。' },
    thunderbolt:{ name: '十万伏特', kind: '光束', cat: '特殊', type: 'electric', unlockLv: 4, dmg: 16, cd: 1.8, range: 16, pierce: 1, desc: '放出强力电流贯穿敌人。' },
    thunder:    { name: '打雷',     kind: '弹丸', cat: '特殊', type: 'electric', unlockLv: 7, dmg: 36, cd: 3.5, range: 24, pierce: 1, desc: '召唤天雷轰击远处敌人。' },
    /* —— 一般 —— */
    tackle:     { name: '撞击',     kind: '弹丸', cat: '物理', type: 'normal', unlockLv: 1, dmg: 15, cd: 0.7, range: 12, pierce: 0, desc: '用身体撞向最近的敌人。' },
    bite:       { name: '咬住',     kind: '连射', cat: '物理', type: 'normal', unlockLv: 2, dmg: 7, shots: 3, cd: 0.7, range: 10, pierce: 0, desc: '连续撕咬近距离敌人。' },
    swift:      { name: '高速星星', kind: '弹丸', cat: '特殊', type: 'normal', unlockLv: 4, dmg: 13, shots: 2, cd: 1.2, range: 20, pierce: 0.3, desc: '发射必中的星形光弹。' },
    hyperbeam:  { name: '破坏光线', kind: '光束', cat: '特殊', type: 'normal', unlockLv: 7, dmg: 40, cd: 4, range: 22, pierce: 1, desc: '释放毁灭性光束，威力极高。' },
    /* —— 卡比兽 —— */
    slam:       { name: '拍击',     kind: '旋转', cat: '物理', type: 'normal', unlockLv: 1, dmg: 20, cd: 1.3, radius: 3, desc: '抡起巨掌拍飞周围敌人。' },
    yawn:       { name: '哈欠',     kind: '光环', cat: '特殊', type: 'normal', unlockLv: 2, dmg: 8, cd: 2, radius: 5, desc: '打个大哈欠，让周围敌人昏昏欲睡。' },
    bodyslam:   { name: '压扁',     kind: '弹丸', cat: '物理', type: 'normal', unlockLv: 4, dmg: 24, cd: 2.2, range: 6, pierce: 0, desc: '泰山压顶砸向前方。' },
    explosion:  { name: '大爆炸',   kind: '光束', cat: '特殊', type: 'normal', unlockLv: 7, dmg: 42, cd: 4.2, range: 18, pierce: 1, desc: '以自身为中心引爆冲击波。' }
  };

  /* ============================================================
     角色卡：base=六维种族值 run=对局中属性 passive=职业被动
     moves=招式组(4) ultimate=R终极技 chart=弱点/抵抗/克制
     evo=进化链（局内进化）
     ============================================================ */
  var CHARACTERS = [
    {
      id: 'squirtle', num: '#007', name: '杰尼龟', type: 'water', role: '防御者', rarity: '普通',
      sprite: 'squirtle', chain: ['squirtle', 'wartortle', 'blastoise'],
      base: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
      run: { maxHp: 108, armor: 26, dodge: 0.04, speedMul: 1.02, physMul: 1.00, specMul: 1.01, regen: 0.5, crit: 0.05 },
      passive: { name: '激流之壳', desc: '护甲 +15，护盾 +20。HP 低于 40% 时，伤害 +40%。' },
      moves: ['watergun', 'bubble', 'rapidspin', 'hydropump'],
      ultimate: { name: '贝壳旋风', desc: '你在壳里旋转：一股漩涡卷走附近的敌人，不停击打，最后以一道巨浪收尾。' },
      chart: { weak: ['grass', 'electric'], resist: ['fire', 'water', 'ice', 'steel'], strong: ['fire', 'rock', 'ground'] },
      evo: [{ at: 24, name: '卡咪龟' }, { at: 44, name: '水箭龟' }]
    },
    {
      id: 'bulbasaur', num: '#001', name: '妙蛙种子', type: 'grass', role: '辅助', rarity: '普通',
      sprite: 'bulbasaur', chain: ['bulbasaur', 'ivysaur', 'venusaur'],
      base: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
      run: { maxHp: 110, armor: 20, dodge: 0.04, speedMul: 1.00, physMul: 0.99, specMul: 1.05, regen: 0.9, crit: 0.05 },
      passive: { name: '光合作用', desc: '回复 +0.4/s。受伤后 3 秒内回复翻倍。' },
      moves: ['vinewhip', 'razorleaf', 'leechseed', 'solarbeam'],
      ultimate: { name: '疯狂植物', desc: '大地暴走：巨型藤蔓从你脚下炸开，横扫全场敌人并回复生命。' },
      chart: { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], resist: ['water', 'grass', 'electric', 'ground'], strong: ['water', 'ground', 'rock'] },
      evo: [{ at: 24, name: '妙蛙草' }, { at: 44, name: '妙蛙花' }]
    },
    {
      id: 'charmander', num: '#004', name: '小火龙', type: 'fire', role: '攻击者', rarity: '普通',
      sprite: 'charmander', chain: ['charmander', 'charmeleon', 'charizard'],
      base: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
      run: { maxHp: 98, armor: 17, dodge: 0.07, speedMul: 1.12, physMul: 1.04, specMul: 1.06, regen: 0.3, crit: 0.08 },
      passive: { name: '猛火', desc: '物理/特殊伤害各 +5%。HP 低于 33% 时，伤害 +50%。' },
      moves: ['ember', 'flamewheel', 'flamethrower', 'fireblast'],
      ultimate: { name: '闪焰冲锋', desc: '全身裹火向前冲锋，碾碎路径上的一切，留下燃烧轨迹。' },
      chart: { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], strong: ['grass', 'ice', 'bug', 'steel'] },
      evo: [{ at: 24, name: '火恐龙' }, { at: 44, name: '喷火龙' }]
    },
    {
      id: 'pikachu', num: '#025', name: '皮卡丘', type: 'electric', role: '速攻手', rarity: '普通',
      sprite: 'pikachu', chain: ['pikachu', 'raichu'],
      base: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
      run: { maxHp: 92, armor: 15, dodge: 0.10, speedMul: 1.22, physMul: 1.02, specMul: 1.02, regen: 0.2, crit: 0.12 },
      passive: { name: '避雷针', desc: '闪避 +6%，速度 ×1.05。完美闪避后下一次攻击必暴击。' },
      moves: ['thundershock', 'quickattack', 'thunderbolt', 'thunder'],
      ultimate: { name: '千万伏特', desc: '释放积蓄的全部电力：全场雷暴，电击屏幕内所有敌人。' },
      chart: { weak: ['ground'], resist: ['electric', 'flying', 'steel'], strong: ['water', 'flying'] },
      evo: [{ at: 24, name: '雷丘' }]
    },
    {
      id: 'eevee', num: '#133', name: '伊布', type: 'normal', role: '速攻手', rarity: '稀有',
      sprite: 'eevee', chain: ['eevee', 'vaporeon'],
      base: { hp: 55, atk: 55, def: 50, spa: 45, spd: 65, spe: 55 },
      run: { maxHp: 130, armor: 22, dodge: 0.08, speedMul: 1.08, physMul: 1.03, specMul: 1.00, regen: 0.6, crit: 0.09 },
      passive: { name: '适应力', desc: '所有伤害 +8%。捕获率 +20%。' },
      moves: ['tackle', 'bite', 'swift', 'hyperbeam'],
      ultimate: { name: '珍藏', desc: '使出浑身解数：连续爆发多段全屏冲击。' },
      chart: { weak: ['fighting'], resist: [], strong: [] },
      evo: [{ at: 24, name: '水伊布' }]
    },
    {
      id: 'snorlax', num: '#143', name: '卡比兽', type: 'normal', role: '防御者', rarity: '稀有',
      sprite: 'snorlax', chain: ['snorlax'],
      base: { hp: 160, atk: 110, def: 65, spa: 65, spd: 110, spe: 30 },
      run: { maxHp: 340, armor: 32, dodge: 0.01, speedMul: 0.85, physMul: 1.10, specMul: 1.05, regen: 1.2, crit: 0.05 },
      passive: { name: '厚脂肪', desc: '护甲 +20，最大HP +60。受到伤害 -10%。' },
      moves: ['slam', 'yawn', 'bodyslam', 'explosion'],
      ultimate: { name: '大爆炸', desc: '以自己为中心引爆，毁灭周围一切（自己不会倒下）。' },
      chart: { weak: ['fighting'], resist: [], strong: [] },
      evo: []
    }
  ];

  /* ============================================================
     地区：4 地区 × (3 区域守护者池 + 圣地 Boss)
     ============================================================ */
  var REGIONS = [
    {
      id: 'forest', name: '青翠森林', types: ['grass', 'bug', 'normal', 'flying'],
      desc: '一片生机盎然的茂密森林。还有不愿分享它的宝可梦。',
      terrain: '#2d5a27',
      guardians: [
        ['scyther', 'raichu', 'golduck'],
        ['pinsir', 'poliwrath', 'persian'],
        ['nidoking', 'golem', 'arcanine'],
        ['mewtwo']
      ]
    },
    {
      id: 'desert', name: '岩石沙漠', types: ['ground', 'rock', 'fighting'],
      desc: '炽热的沙海与嶙峋的怪石。流沙之下潜伏着硬骨头。',
      terrain: '#a5763f',
      guardians: [
        ['sandslash', 'machamp', 'onix'],
        ['marowak', 'golem', 'hitmonlee'],
        ['rhydon', 'dugtrio', 'primeape'],
        ['dragonite']
      ]
    },
    {
      id: 'coast', name: '风暴海岸', types: ['water', 'electric', 'flying'],
      desc: '雷暴肆虐的海岸线。浪涛里藏着带电的猎手。',
      terrain: '#2a5c78',
      guardians: [
        ['golduck', 'electabuzz', 'aerodactyl'],
        ['tentacruel', 'lanturn', 'gyarados'],
        ['lapras', 'raichu', 'dodrio'],
        ['zapdos']
      ]
    },
    {
      id: 'glacier', name: '天空冰川', types: ['ice', 'water', 'psychic'],
      desc: '万年不化的冰川高地。极寒中回荡着超能力的低语。',
      terrain: '#6fa8c9',
      guardians: [
        ['dewgong', 'jynx', 'slowbro'],
        ['cloyster', 'lapras', 'hypno'],
        ['walrein', 'starmie', 'alakazam'],
        ['articuno']
      ]
    }
  ];

  /* 难度：sand=星星沙子倍率 enemyMul=敌人强化 */
  var DIFFICULTIES = [
    { id: 'normal', name: '普通', sand: 1, enemyMul: 1, desc: '星星沙子 ×1' },
    { id: 'hard', name: '困难', sand: 1.75, enemyMul: 1.7, desc: '星星沙子 ×1.75 · 敌人 +70%' },
    { id: 'nightmare', name: '噩梦', sand: 2.5, enemyMul: 2.6, desc: '星星沙子 ×2.5 · 敌人 +160%' }
  ];

  /* 计时赛奖牌（经典模式总用时） */
  var MEDALS = [
    { id: 'bronze', name: '青铜', cond: '任意胜利', limit: Infinity },
    { id: 'silver', name: '银', cond: '不到 24:00', limit: 1440 },
    { id: 'gold', name: '金', cond: '不到 18:00', limit: 1080 },
    { id: 'champion', name: '冠军', cond: '不到 13:30', limit: 810 }
  ];

  /* 野生宝可梦（普通敌人）：hp=生命 atk=接触伤害 spd=移速 xp=经验 */
  var WILD = [
    { id: 'caterpie', name: '绿毛虫', type: 'bug', hp: 18, atk: 8, spd: 1.6, xp: 2, sprite: 'caterpie', size: 15 },
    { id: 'weedle', name: '独角虫', type: 'bug', hp: 16, atk: 9, spd: 1.9, xp: 2, sprite: 'weedle', size: 15 },
    { id: 'pidgey', name: '波波', type: 'flying', hp: 22, atk: 10, spd: 2.1, xp: 3, sprite: 'pidgey', size: 17 },
    { id: 'rattata', name: '小拉达', type: 'normal', hp: 20, atk: 11, spd: 2.3, xp: 3, sprite: 'rattata', size: 16 },
    { id: 'zubat', name: '超音蝠', type: 'poison', hp: 24, atk: 11, spd: 2.2, xp: 3, sprite: 'zubat', size: 17 },
    { id: 'oddish', name: '走路草', type: 'grass', hp: 28, atk: 12, spd: 1.5, xp: 4, sprite: 'oddish', size: 18 },
    { id: 'geodude', name: '小拳石', type: 'rock', hp: 42, atk: 14, spd: 1.2, xp: 5, sprite: 'geodude', size: 20 },
    { id: 'magikarp', name: '鲤鱼王', type: 'water', hp: 30, atk: 6, spd: 1.4, xp: 4, sprite: 'magikarp', size: 18 },
    { id: 'sandshrew', name: '穿山鼠', type: 'ground', hp: 36, atk: 13, spd: 1.7, xp: 5, sprite: 'sandshrew', size: 19 },
    { id: 'psyduck', name: '可达鸭', type: 'water', hp: 32, atk: 12, spd: 1.6, xp: 4, sprite: 'psyduck', size: 19 },
    { id: 'machop', name: '腕力', type: 'fighting', hp: 40, atk: 16, spd: 1.6, xp: 6, sprite: 'machop', size: 20 },
    { id: 'shellder', name: '大舌贝', type: 'ice', hp: 38, atk: 13, spd: 1.3, xp: 5, sprite: 'shellder', size: 18 },
    { id: 'drowzee', name: '呆呆兽', type: 'psychic', hp: 34, atk: 12, spd: 1.5, xp: 5, sprite: 'drowzee', size: 19 },
    { id: 'seel', name: '小海狮', type: 'ice', hp: 36, atk: 12, spd: 1.5, xp: 5, sprite: 'seel', size: 19 }
  ];

  /* Boss / 守护者：hp 放大 atk 接触伤害 spd 移速 r 体型 */
  var BOSSES = {
    scyther:    { name: '飞天螳螂', type: 'bug', hp: 900, atk: 26, spd: 2.6, r: 34, sprite: 'scyther' },
    raichu:     { name: '雷丘', type: 'electric', hp: 850, atk: 24, spd: 2.8, r: 32, sprite: 'raichu' },
    golduck:    { name: '哥达鸭', type: 'water', hp: 880, atk: 23, spd: 2.4, r: 33, sprite: 'golduck' },
    pinsir:     { name: '凯罗斯', type: 'bug', hp: 1000, atk: 28, spd: 2.2, r: 35, sprite: 'pinsir' },
    poliwrath:  { name: '蚊香泳士', type: 'fighting', hp: 1050, atk: 27, spd: 2.3, r: 35, sprite: 'poliwrath' },
    persian:    { name: '猫老大', type: 'normal', hp: 950, atk: 25, spd: 3.0, r: 32, sprite: 'persian' },
    nidoking:   { name: '尼多王', type: 'poison', hp: 1300, atk: 32, spd: 2.2, r: 38, sprite: 'nidoking' },
    golem:      { name: '隆隆岩', type: 'rock', hp: 1450, atk: 30, spd: 1.8, r: 40, sprite: 'golem' },
    arcanine:   { name: '风速狗', type: 'fire', hp: 1250, atk: 31, spd: 3.1, r: 38, sprite: 'arcanine' },
    sandslash:  { name: '穿山王', type: 'ground', hp: 1000, atk: 27, spd: 2.4, r: 34, sprite: 'sandslash' },
    machamp:    { name: '怪力', type: 'fighting', hp: 1100, atk: 32, spd: 2.1, r: 36, sprite: 'machamp' },
    onix:       { name: '大岩蛇', type: 'rock', hp: 1250, atk: 28, spd: 1.9, r: 42, sprite: 'onix' },
    marowak:    { name: '嘎啦嘎啦', type: 'ground', hp: 1050, atk: 29, spd: 2.3, r: 34, sprite: 'marowak' },
    hitmonlee:  { name: '飞腿郎', type: 'fighting', hp: 980, atk: 33, spd: 2.6, r: 33, sprite: 'hitmonlee' },
    rhydon:     { name: '钻角犀兽', type: 'ground', hp: 1500, atk: 35, spd: 2.0, r: 42, sprite: 'rhydon' },
    dugtrio:    { name: '三地鼠', type: 'ground', hp: 900, atk: 26, spd: 3.2, r: 32, sprite: 'dugtrio' },
    primeape:   { name: '火暴猴', type: 'fighting', hp: 950, atk: 31, spd: 2.9, r: 33, sprite: 'primeape' },
    electabuzz: { name: '电击兽', type: 'electric', hp: 1150, atk: 30, spd: 2.7, r: 35, sprite: 'electabuzz' },
    aerodactyl: { name: '化石翼龙', type: 'rock', hp: 1350, atk: 33, spd: 3.0, r: 40, sprite: 'aerodactyl' },
    tentacruel: { name: '毒刺水母', type: 'poison', hp: 1250, atk: 28, spd: 2.5, r: 40, sprite: 'tentacruel' },
    gyarados:   { name: '暴鲤龙', type: 'water', hp: 1600, atk: 36, spd: 2.4, r: 44, sprite: 'gyarados' },
    lapras:     { name: '拉普拉斯', type: 'ice', hp: 1450, atk: 30, spd: 2.2, r: 42, sprite: 'lapras' },
    dodrio:     { name: '嘟嘟利', type: 'flying', hp: 1100, atk: 30, spd: 3.1, r: 35, sprite: 'dodrio' },
    dewgong:    { name: '白海狮', type: 'ice', hp: 1300, atk: 29, spd: 2.3, r: 40, sprite: 'dewgong' },
    jynx:       { name: '迷唇姐', type: 'ice', hp: 1150, atk: 31, spd: 2.5, r: 35, sprite: 'jynx' },
    slowbro:    { name: '呆壳兽', type: 'water', hp: 1350, atk: 28, spd: 2.0, r: 40, sprite: 'slowbro' },
    cloyster:   { name: '刺甲贝', type: 'ice', hp: 1550, atk: 31, spd: 1.8, r: 42, sprite: 'cloyster' },
    hypno:      { name: '催眠貘', type: 'psychic', hp: 1200, atk: 29, spd: 2.4, r: 36, sprite: 'hypno' },
    starmie:    { name: '宝石海星', type: 'water', hp: 1300, atk: 31, spd: 2.7, r: 38, sprite: 'starmie' },
    alakazam:   { name: '胡地', type: 'psychic', hp: 1150, atk: 35, spd: 2.6, r: 35, sprite: 'alakazam' },
    walrein:    { name: '帝牙海狮', type: 'ice', hp: 1650, atk: 33, spd: 2.1, r: 44, sprite: 'walrein' },
    /* 圣地 Boss */
    mewtwo:     { name: '超梦', type: 'psychic', hp: 3600, atk: 42, spd: 2.8, r: 46, sprite: 'mewtwo', final: true },
    dragonite:  { name: '快龙', type: 'dragon', hp: 3800, atk: 44, spd: 2.6, r: 48, sprite: 'dragonite', final: true },
    zapdos:     { name: '闪电鸟', type: 'electric', hp: 3700, atk: 43, spd: 3.0, r: 46, sprite: 'zapdos', final: true },
    articuno:   { name: '急冻鸟', type: 'ice', hp: 3700, atk: 41, spd: 2.7, r: 46, sprite: 'articuno', final: true }
  };

  /* 升级三选一（对局中属性成长） */
  var UPGRADES = [
    { id: 'hp',     name: '强健体魄', desc: '最大HP +24', icon: '❤', apply: function (p) { p.stats.maxHp += 24; p.hp += 24; } },
    { id: 'armor',  name: '铁壁护甲', desc: '护甲 +6', icon: '🛡', apply: function (p) { p.stats.armor += 6; } },
    { id: 'crit',   name: '锐利目光', desc: '暴击率 +5%', icon: '💥', apply: function (p) { p.stats.crit += 0.05; } },
    { id: 'dodge',  name: '轻盈身法', desc: '闪避 +4%', icon: '💨', apply: function (p) { p.stats.dodge += 0.04; } },
    { id: 'speed',  name: '疾风之速', desc: '移动速度 +8%', icon: '⚡', apply: function (p) { p.stats.speedMul *= 1.08; } },
    { id: 'phys',   name: '重拳出击', desc: '物理伤害 +12%', icon: '👊', apply: function (p) { p.stats.physMul *= 1.12; } },
    { id: 'spec',   name: '灵能涌动', desc: '特殊伤害 +12%', icon: '✨', apply: function (p) { p.stats.specMul *= 1.12; } },
    { id: 'regen',  name: '自然回复', desc: '回复 +0.7/s', icon: '🌿', apply: function (p) { p.stats.regen += 0.7; } },
    { id: 'movedmg', name: '招式精进', desc: '全部招式伤害 +10%', icon: '📖', apply: function (p) { p.moveDmgMul *= 1.10; } },
    { id: 'catch',  name: '精灵球手', desc: '捕获率 +18%', icon: '🎯', apply: function (p) { p.catchBonus += 0.18; } }
  ];

  window.DATA = {
    TYPE_COLORS: TYPE_COLORS,
    TYPE_CN: TYPE_CN,
    effect: effect,
    MOVES: MOVES,
    CHARACTERS: CHARACTERS,
    REGIONS: REGIONS,
    DIFFICULTIES: DIFFICULTIES,
    MEDALS: MEDALS,
    WILD: WILD,
    BOSSES: BOSSES,
    UPGRADES: UPGRADES
  };
})();
