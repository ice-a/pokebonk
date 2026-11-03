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
    explosion:  { name: '大爆炸',   kind: '光束', cat: '特殊', type: 'normal', unlockLv: 7, dmg: 42, cd: 4.2, range: 18, pierce: 1, desc: '以自身为中心引爆冲击波。' },
    /* —— 幽灵 —— */
    lick:        { name: '舔舌头',   kind: '弹丸', cat: '物理', type: 'ghost', unlockLv: 1, dmg: 16, cd: 0.8, range: 12, pierce: 0, desc: '用长舌头舔舐最近的敌人。' },
    shadowclaw:  { name: '暗影爪',   kind: '连射', cat: '物理', type: 'ghost', unlockLv: 2, dmg: 9, shots: 3, cd: 0.85, range: 13, pierce: 0.2, desc: '以暗影之爪连抓三次。' },
    hex:         { name: '祸不单行', kind: '光环', cat: '特殊', type: 'ghost', unlockLv: 4, dmg: 11, cd: 2, radius: 5.5, desc: '诅咒周围敌人，持续吸取它们的生命。' },
    shadowball:  { name: '暗影球',   kind: '弹丸', cat: '特殊', type: 'ghost', unlockLv: 7, dmg: 32, cd: 2.4, range: 18, pierce: 0.4, desc: '投出凝聚怨念的暗影球。' },
    /* —— 格斗 —— */
    karatechop:  { name: '空手劈',   kind: '弹丸', cat: '物理', type: 'fighting', unlockLv: 1, dmg: 17, cd: 0.75, range: 11, pierce: 0, desc: '蓄力一记手刀劈向敌人。' },
    lowkick:     { name: '踢倒',     kind: '旋转', cat: '物理', type: 'fighting', unlockLv: 2, dmg: 13, cd: 1.1, radius: 3.2, desc: '扫堂腿踢翻周围所有敌人。' },
    crosschop:   { name: '十字劈',   kind: '连射', cat: '物理', type: 'fighting', unlockLv: 4, dmg: 12, shots: 3, cd: 1.05, range: 12, pierce: 0.3, desc: '双掌交叉，连击前方敌人。' },
    closecombat: { name: '近身战',   kind: '光束', cat: '物理', type: 'fighting', unlockLv: 7, dmg: 26, cd: 2.6, range: 10, pierce: 1, desc: '贴身爆发全力一击。' },
    /* —— 超能力 —— */
    confusion:   { name: '念力',     kind: '弹丸', cat: '特殊', type: 'psychic', unlockLv: 1, dmg: 16, cd: 0.8, range: 18, pierce: 0.15, desc: '用念力震荡最近敌人的意识。' },
    psybeam:     { name: '幻象光线', kind: '光束', cat: '特殊', type: 'psychic', unlockLv: 2, dmg: 11, cd: 1.5, range: 16, pierce: 1, desc: '射出扭曲现实的光线。' },
    psychicwave: { name: '精神强念', kind: '连射', cat: '特殊', type: 'psychic', unlockLv: 4, dmg: 10, shots: 3, cd: 1.0, range: 17, pierce: 0.35, desc: '连续投掷精神冲击。' },
    futuresight: { name: '预知未来', kind: '弹丸', cat: '特殊', type: 'psychic', unlockLv: 7, dmg: 38, cd: 3.2, range: 22, pierce: 0.5, desc: '预言敌人的终局，届时一击落下。' },
    /* —— 地面 —— */
    mudshot:     { name: '泥巴射击', kind: '弹丸', cat: '特殊', type: 'ground', unlockLv: 1, dmg: 15, cd: 0.75, range: 15, pierce: 0.2, desc: '射出泥块减速敌人。' },
    bulldoze:    { name: '重踏',     kind: '旋转', cat: '物理', type: 'ground', unlockLv: 2, dmg: 14, cd: 1.2, radius: 3.4, desc: '践踏大地，震退周围敌人。' },
    earthquake:  { name: '地震',     kind: '光环', cat: '物理', type: 'ground', unlockLv: 7, dmg: 30, cd: 3, radius: 7, desc: '引发地裂，全场敌人承受冲击。' },
    /* —— 岩石 —— */
    rockthrow:   { name: '落石',     kind: '弹丸', cat: '物理', type: 'rock', unlockLv: 1, dmg: 18, cd: 0.9, range: 16, pierce: 0, desc: '举起石块砸向敌人。' },
    rockblast:   { name: '岩石爆击', kind: '连射', cat: '物理', type: 'rock', unlockLv: 2, dmg: 7, shots: 4, cd: 1.0, range: 15, pierce: 0.2, desc: '连续弹射碎石。' },
    stoneedge:   { name: '尖石攻击', kind: '光束', cat: '物理', type: 'rock', unlockLv: 7, dmg: 28, cd: 2.8, range: 18, pierce: 1, desc: '从地下刺出锐利岩柱。' },
    /* —— 冰 —— */
    powdersnow:  { name: '粉雪',     kind: '弹丸', cat: '特殊', type: 'ice', unlockLv: 1, dmg: 15, cd: 0.75, range: 16, pierce: 0.1, desc: '吹出寒冷雪粉。' },
    icywind:     { name: '冰冻之风', kind: '连射', cat: '特殊', type: 'ice', unlockLv: 2, dmg: 8, shots: 3, cd: 0.9, range: 16, pierce: 0.3, desc: '寒风连击并减速敌人。' },
    icebeam:     { name: '冰冻光束', kind: '光束', cat: '特殊', type: 'ice', unlockLv: 4, dmg: 15, cd: 1.9, range: 16, pierce: 1, desc: '射出绝对零度的光束。' },
    blizzard:    { name: '暴风雪',   kind: '光环', cat: '特殊', type: 'ice', unlockLv: 7, dmg: 34, cd: 3.6, radius: 6.5, desc: '召唤暴风雪横扫四周。' },
    /* —— 龙 —— */
    twister:     { name: '龙卷风',   kind: '弹丸', cat: '特殊', type: 'dragon', unlockLv: 1, dmg: 16, cd: 0.8, range: 16, pierce: 0.3, desc: '卷起龙之旋风。' },
    dragonbreath:{ name: '龙息',     kind: '光束', cat: '特殊', type: 'dragon', unlockLv: 2, dmg: 11, cd: 1.6, range: 15, pierce: 1, desc: '喷出灼热的龙息。' },
    dragonrush:  { name: '龙之俯冲', kind: '连射', cat: '物理', type: 'dragon', unlockLv: 4, dmg: 14, shots: 2, cd: 1.4, range: 14, pierce: 0.4, desc: '俯冲撞击并连击。' },
    outrage:     { name: '逆鳞',     kind: '旋转', cat: '物理', type: 'dragon', unlockLv: 7, dmg: 38, cd: 3.4, radius: 4.2, desc: '陷入暴走，碾碎身边一切。' },
    /* —— 恶 —— */
    feintattack: { name: '出奇一击', kind: '弹丸', cat: '物理', type: 'dark', unlockLv: 1, dmg: 17, cd: 0.8, range: 14, pierce: 0.1, desc: '悄然接近后重击敌人。' },
    snarl:       { name: '大声咆哮', kind: '光环', cat: '特殊', type: 'dark', unlockLv: 2, dmg: 12, cd: 1.8, radius: 5, desc: '咆哮削弱周围敌人。' },
    darkpulse:   { name: '恶之波动', kind: '光束', cat: '特殊', type: 'dark', unlockLv: 7, dmg: 30, cd: 2.9, range: 18, pierce: 1, desc: '释放充满恶意的波动。' },
    /* —— 妖精 —— */
    fairywind:   { name: '妖精之风', kind: '弹丸', cat: '特殊', type: 'fairy', unlockLv: 1, dmg: 14, cd: 0.7, range: 15, pierce: 0.15, desc: '吹出带魔力的微风。' },
    playrough:   { name: '嬉闹',     kind: '连射', cat: '物理', type: 'fairy', unlockLv: 2, dmg: 11, shots: 3, cd: 1.0, range: 12, pierce: 0, desc: '撒欢式连击敌人。' },
    dazzlinggleam:{ name: '魔法闪耀', kind: '光环', cat: '特殊', type: 'fairy', unlockLv: 4, dmg: 16, cd: 2, radius: 5.5, desc: '爆出刺眼闪光伤害四周。' },
    moonblast:   { name: '月亮之力', kind: '光束', cat: '特殊', type: 'fairy', unlockLv: 7, dmg: 30, cd: 2.9, range: 18, pierce: 1, desc: '借月亮之力射出光束。' },
    /* —— 毒 —— */
    poisonsting: { name: '毒针',     kind: '弹丸', cat: '物理', type: 'poison', unlockLv: 1, dmg: 14, cd: 0.65, range: 16, pierce: 0.1, desc: '射出带毒的细针。' },
    acid:        { name: '溶解液',   kind: '光束', cat: '特殊', type: 'poison', unlockLv: 2, dmg: 10, cd: 1.6, range: 12, pierce: 1, desc: '喷出腐蚀性液体。' },
    sludgebomb:  { name: '污泥炸弹', kind: '连射', cat: '特殊', type: 'poison', unlockLv: 7, dmg: 20, shots: 2, cd: 2.2, range: 16, pierce: 0.4, desc: '抛掷污泥炸弹连续爆炸。' },
    /* —— 钢 —— */
    gyroball:    { name: '陀螺球',   kind: '旋转', cat: '物理', type: 'steel', unlockLv: 2, dmg: 13, cd: 1.1, radius: 3.3, desc: '高速旋转撞击周围敌人。' },
    flashcannon: { name: '加农光炮', kind: '光束', cat: '特殊', type: 'steel', unlockLv: 7, dmg: 29, cd: 2.9, range: 18, pierce: 1, desc: '发射聚焦的钢铁光束。' },
    /* —— 虫 —— */
    bugbite:     { name: '虫咬',     kind: '弹丸', cat: '物理', type: 'bug', unlockLv: 1, dmg: 15, cd: 0.7, range: 13, pierce: 0, desc: '扑上去撕咬敌人。' },
    xscissor:    { name: '十字剪',   kind: '连射', cat: '物理', type: 'bug', unlockLv: 2, dmg: 10, shots: 3, cd: 0.95, range: 14, pierce: 0.3, desc: '以双刃交叉连斩。' },
    megahorn:    { name: '超级角击', kind: '光束', cat: '物理', type: 'bug', unlockLv: 7, dmg: 33, cd: 3.2, range: 16, pierce: 1, desc: '全力突刺的巨大角击。' },
    /* —— 飞行 —— */
    gust:        { name: '起风',     kind: '弹丸', cat: '特殊', type: 'flying', unlockLv: 1, dmg: 14, cd: 0.7, range: 16, pierce: 0.2, desc: '掀起气流轰击敌人。' },
    wingattack:  { name: '翅膀攻击', kind: '连射', cat: '物理', type: 'flying', unlockLv: 2, dmg: 9, shots: 3, cd: 0.85, range: 13, pierce: 0, desc: '双翼连续拍击。' },
    airslash:    { name: '空气斩',   kind: '光束', cat: '特殊', type: 'flying', unlockLv: 7, dmg: 26, cd: 2.5, range: 20, pierce: 1, desc: '挥出真空刃切开敌人。' },
    /* —— 4 级补充（补齐角色卡 1/2/4/7 节奏） —— */
    rocktomb:    { name: '岩石封锁', kind: '光环', cat: '物理', type: 'rock', unlockLv: 4, dmg: 15, cd: 2.2, radius: 4.5, desc: '砸下巨石封住四周，压碎敌人。' },
    sandtomb:    { name: '流沙地狱', kind: '光环', cat: '物理', type: 'ground', unlockLv: 4, dmg: 14, cd: 2.3, radius: 4.5, desc: '让地面变成流沙，把敌人拖入其中。' },
    aerialace:   { name: '燕返',     kind: '连射', cat: '物理', type: 'flying', unlockLv: 4, dmg: 12, shots: 3, cd: 1.0, range: 15, pierce: 0.4, desc: '以极快速度来回穿刺，必中。' },
    crunch:      { name: '咬碎',     kind: '弹丸', cat: '物理', type: 'dark', unlockLv: 4, dmg: 19, cd: 1.9, range: 13, pierce: 0.2, desc: '用尖牙撕咬，削减敌人防御。' }
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
    },
    /* ============ v3 扩充角色（14 张） ============ */
    {
      id: 'gastly', num: '#092', name: '鬼斯', type: 'ghost', role: '控场', rarity: '稀有',
      sprite: 'gastly', chain: ['gastly', 'haunter', 'gengar'],
      base: { hp: 30, atk: 35, def: 30, spa: 100, spd: 35, spe: 80 },
      run: { maxHp: 86, armor: 12, dodge: 0.12, speedMul: 1.16, physMul: 0.96, specMul: 1.12, regen: 0.2, crit: 0.10 },
      passive: { name: '漂浮', desc: '闪避 +4%，特殊伤害 +8%。' },
      moves: ['lick', 'shadowclaw', 'hex', 'shadowball'],
      ultimate: { name: '黑夜魔影', desc: '拉下夜幕，无数怨念之手从地面伸出，撕扯全场敌人。' },
      chart: { weak: ['psychic', 'ghost', 'dark'], resist: ['bug', 'poison', 'normal', 'fighting'], strong: ['psychic', 'ghost'] },
      evo: [{ at: 24, name: '鬼斯通' }, { at: 44, name: '耿鬼' }]
    },
    {
      id: 'machop', num: '#066', name: '腕力', type: 'fighting', role: '攻击者', rarity: '普通',
      sprite: 'machop', chain: ['machop', 'machoke', 'machamp'],
      base: { hp: 70, atk: 80, def: 50, spa: 35, spd: 35, spe: 35 },
      run: { maxHp: 150, armor: 24, dodge: 0.05, speedMul: 1.02, physMul: 1.12, specMul: 0.94, regen: 0.4, crit: 0.09 },
      passive: { name: '毅力', desc: '物理伤害 +8%。受伤后 3 秒内物理伤害再 +20%。' },
      moves: ['karatechop', 'lowkick', 'crosschop', 'closecombat'],
      ultimate: { name: '爆裂拳', desc: '连续四记重拳砸向地面，冲击波扩散撕碎周围敌人。' },
      chart: { weak: ['psychic', 'flying', 'fairy'], resist: ['rock', 'bug', 'dark'], strong: ['normal', 'ice', 'rock', 'dark', 'steel'] },
      evo: [{ at: 24, name: '豪力' }, { at: 44, name: '怪力' }]
    },
    {
      id: 'abra', num: '#063', name: '凯西', type: 'psychic', role: '爆发', rarity: '稀有',
      sprite: 'abra', chain: ['abra', 'kadabra', 'alakazam'],
      base: { hp: 25, atk: 20, def: 15, spa: 105, spd: 55, spe: 90 },
      run: { maxHp: 78, armor: 10, dodge: 0.14, speedMul: 1.20, physMul: 0.90, specMul: 1.16, regen: 0.2, crit: 0.08 },
      passive: { name: '同步', desc: '特殊伤害 +10%。血量越低闪避越高（最多 +8%）。' },
      moves: ['confusion', 'psybeam', 'psychicwave', 'futuresight'],
      ultimate: { name: '精神强袭', desc: '瞬间移动并把全部念力灌入一点，引发覆盖全场的空间扭曲。' },
      chart: { weak: ['bug', 'ghost', 'dark'], resist: ['fighting', 'psychic'], strong: ['fighting', 'poison'] },
      evo: [{ at: 24, name: '勇基拉' }, { at: 44, name: '胡地' }]
    },
    {
      id: 'dratini', num: '#147', name: '迷你龙', type: 'dragon', role: '成长', rarity: '稀有',
      sprite: 'dratini', chain: ['dratini', 'dragonair', 'dragonite'],
      base: { hp: 41, atk: 64, def: 45, spa: 50, spd: 50, spe: 50 },
      run: { maxHp: 118, armor: 20, dodge: 0.06, speedMul: 1.06, physMul: 1.05, specMul: 1.04, regen: 0.6, crit: 0.08 },
      passive: { name: '神秘鳞片', desc: '受到伤害 -8%。每次升级额外 +6 最大HP。' },
      moves: ['twister', 'dragonbreath', 'dragonrush', 'outrage'],
      ultimate: { name: '逆鳞爆发', desc: '龙鳞炸张，旋转龙卷裹住自身，把周围敌人卷入风暴中心撕碎。' },
      chart: { weak: ['ice', 'dragon', 'fairy'], resist: ['fire', 'water', 'grass', 'electric'], strong: ['dragon'] },
      evo: [{ at: 24, name: '哈克龙' }, { at: 44, name: '快龙' }]
    },
    {
      id: 'geodude', num: '#074', name: '小拳石', type: 'rock', role: '防御者', rarity: '普通',
      sprite: 'geodude', chain: ['geodude', 'graveler', 'golem'],
      base: { hp: 40, atk: 80, def: 100, spa: 30, spd: 30, spe: 20 },
      run: { maxHp: 142, armor: 32, dodge: 0.02, speedMul: 0.92, physMul: 1.10, specMul: 0.92, regen: 0.3, crit: 0.05 },
      passive: { name: '坚硬岩石', desc: '护甲 +14。受到物理伤害 -6%。' },
      moves: ['rockthrow', 'rockblast', 'rocktomb', 'stoneedge'],
      ultimate: { name: '岩石爆破', desc: '猛地砸向地面，一圈岩柱从脚下爆开，把敌人全部顶飞。' },
      chart: { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], resist: ['normal', 'fire', 'poison', 'flying'], strong: ['fire', 'ice', 'flying', 'bug'] },
      evo: [{ at: 24, name: '隆隆石' }, { at: 44, name: '隆隆岩' }]
    },
    {
      id: 'sandshrew', num: '#027', name: '穿山鼠', type: 'ground', role: '防御者', rarity: '普通',
      sprite: 'sandshrew', chain: ['sandshrew', 'sandslash'],
      base: { hp: 50, atk: 75, def: 85, spa: 20, spd: 30, spe: 40 },
      run: { maxHp: 136, armor: 28, dodge: 0.05, speedMul: 1.05, physMul: 1.08, specMul: 0.94, regen: 0.4, crit: 0.07 },
      passive: { name: '沙隐', desc: '闪避 +5%。沙地移动速度 +8%。' },
      moves: ['mudshot', 'bulldoze', 'sandtomb', 'earthquake'],
      ultimate: { name: '沙暴突袭', desc: '卷成沙球高速滚动，沿途掀起沙暴，碾碎路径上的一切。' },
      chart: { weak: ['water', 'grass', 'ice'], resist: ['poison', 'rock', 'electric'], strong: ['fire', 'electric', 'poison', 'rock', 'steel'] },
      evo: [{ at: 24, name: '穿山王' }]
    },
    {
      id: 'vulpix', num: '#037', name: '六尾', type: 'fire', role: '速攻手', rarity: '普通',
      sprite: 'vulpix', chain: ['vulpix', 'ninetales'],
      base: { hp: 38, atk: 41, def: 40, spa: 50, spd: 65, spe: 65 },
      run: { maxHp: 96, armor: 16, dodge: 0.08, speedMul: 1.10, physMul: 0.98, specMul: 1.10, regen: 0.4, crit: 0.08 },
      passive: { name: '引火', desc: '火系伤害 +10%。受到火系伤害减半。' },
      moves: ['ember', 'flamewheel', 'flamethrower', 'fireblast'],
      ultimate: { name: '炼狱', desc: '六条尾巴同时燃起，把四周烧成火海，持续灼烧所有敌人。' },
      chart: { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], strong: ['grass', 'ice', 'bug', 'steel'] },
      evo: [{ at: 24, name: '九尾' }]
    },
    {
      id: 'seel', num: '#086', name: '小海狮', type: 'ice', role: '辅助', rarity: '普通',
      sprite: 'seel', chain: ['seel', 'dewgong'],
      base: { hp: 65, atk: 45, def: 55, spa: 45, spd: 70, spe: 45 },
      run: { maxHp: 150, armor: 24, dodge: 0.06, speedMul: 1.02, physMul: 1.00, specMul: 1.08, regen: 0.7, crit: 0.06 },
      passive: { name: '冰之躯体', desc: '护甲 +8，冰系伤害 +8%。' },
      moves: ['powdersnow', 'icywind', 'icebeam', 'blizzard'],
      ultimate: { name: '极寒暴风', desc: '唤起暴风雪，冰晶在空中炸裂，冻结并击碎全场敌人。' },
      chart: { weak: ['electric', 'grass', 'fighting', 'rock', 'steel'], resist: ['ice'], strong: ['grass', 'ground', 'flying', 'dragon'] },
      evo: [{ at: 24, name: '白海狮' }]
    },
    {
      id: 'clefairy', num: '#035', name: '皮皮', type: 'fairy', role: '辅助', rarity: '稀有',
      sprite: 'clefairy', chain: ['clefairy', 'clefable'],
      base: { hp: 70, atk: 45, def: 48, spa: 60, spd: 65, spe: 35 },
      run: { maxHp: 160, armor: 22, dodge: 0.07, speedMul: 1.00, physMul: 1.02, specMul: 1.08, regen: 0.9, crit: 0.07 },
      passive: { name: '魔法守护', desc: '回复 +0.6/s。受到特殊伤害 -8%。' },
      moves: ['fairywind', 'playrough', 'dazzlinggleam', 'moonblast'],
      ultimate: { name: '月亮之歌', desc: '月光倾泻，治愈自身并把星光化作冲击波扫过全场。' },
      chart: { weak: ['poison', 'steel'], resist: ['fighting', 'bug', 'dark'], strong: ['fighting', 'dragon', 'dark'] },
      evo: [{ at: 24, name: '皮可西' }]
    },
    {
      id: 'scyther', num: '#123', name: '飞天螳螂', type: 'bug', role: '速攻手', rarity: '稀有',
      sprite: 'scyther', chain: ['scyther', 'scizor'],
      base: { hp: 70, atk: 110, def: 80, spa: 55, spd: 80, spe: 105 },
      run: { maxHp: 132, armor: 22, dodge: 0.10, speedMul: 1.18, physMul: 1.12, specMul: 0.96, regen: 0.3, crit: 0.13 },
      passive: { name: '技术高手', desc: '物理伤害 +8%，暴击率 +4%。' },
      moves: ['bugbite', 'xscissor', 'aerialace', 'megahorn'],
      ultimate: { name: '双刃斩', desc: '化作残影高速穿梭，镰刀连斩全场敌人，最后交叉一刀收尾。' },
      chart: { weak: ['fire', 'flying', 'rock'], resist: ['grass', 'fighting', 'bug'], strong: ['grass', 'psychic', 'dark'] },
      evo: [{ at: 30, name: '巨钳螳螂' }]
    },
    {
      id: 'koffing', num: '#109', name: '瓦斯弹', type: 'poison', role: '防御者', rarity: '普通',
      sprite: 'koffing', chain: ['koffing', 'weezing'],
      base: { hp: 40, atk: 65, def: 95, spa: 60, spd: 45, spe: 35 },
      run: { maxHp: 128, armor: 26, dodge: 0.04, speedMul: 0.98, physMul: 1.02, specMul: 1.06, regen: 0.4, crit: 0.06 },
      passive: { name: '浮游', desc: '免疫地面属性伤害。毒系伤害 +6%。' },
      moves: ['poisonsting', 'acid', 'hex', 'sludgebomb'],
      ultimate: { name: '毒气爆发', desc: '外壳破裂，毒雾以自身为中心爆炸扩散，持续腐蚀全场敌人。' },
      chart: { weak: ['psychic', 'ground'], resist: ['grass', 'fighting', 'poison', 'bug', 'fairy'], strong: ['grass', 'fairy'] },
      evo: [{ at: 24, name: '双弹瓦斯' }]
    },
    {
      id: 'magnemite', num: '#081', name: '小磁怪', type: 'steel', role: '输出', rarity: '普通',
      sprite: 'magnemite', chain: ['magnemite', 'magneton'],
      base: { hp: 25, atk: 35, def: 70, spa: 95, spd: 55, spe: 45 },
      run: { maxHp: 92, armor: 30, dodge: 0.05, speedMul: 1.00, physMul: 0.94, specMul: 1.12, regen: 0.2, crit: 0.08 },
      passive: { name: '磁力', desc: '特殊伤害 +8%，护甲 +10。' },
      moves: ['thundershock', 'gyroball', 'thunderbolt', 'flashcannon'],
      ultimate: { name: '电磁炮', desc: '把两侧磁铁的全部能量压进一发炮弹，贯穿路径上所有敌人。' },
      chart: { weak: ['fire', 'fighting', 'ground'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], strong: ['ice', 'rock', 'fairy'] },
      evo: [{ at: 24, name: '三合一磁怪' }]
    },
    {
      id: 'pidgey', num: '#016', name: '波波', type: 'flying', role: '速攻手', rarity: '普通',
      sprite: 'pidgey', chain: ['pidgey', 'pidgeotto', 'pidgeot'],
      base: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
      run: { maxHp: 100, armor: 16, dodge: 0.10, speedMul: 1.20, physMul: 1.04, specMul: 1.00, regen: 0.3, crit: 0.10 },
      passive: { name: '锐利目光', desc: '暴击率 +3%，移动速度 +5%。' },
      moves: ['gust', 'wingattack', 'aerialace', 'airslash'],
      ultimate: { name: '神鸟猛击', desc: '冲上高空后俯冲，携风压贯穿全场，落地掀起气浪。' },
      chart: { weak: ['electric', 'ice', 'rock'], resist: ['grass', 'fighting', 'bug'], strong: ['grass', 'fighting', 'bug'] },
      evo: [{ at: 20, name: '比比鸟' }, { at: 40, name: '大比鸟' }]
    },
    {
      id: 'houndour', num: '#228', name: '戴鲁比', type: 'dark', role: '爆发', rarity: '稀有',
      sprite: 'houndour', chain: ['houndour', 'houndoom'],
      base: { hp: 45, atk: 60, def: 30, spa: 80, spd: 50, spe: 65 },
      run: { maxHp: 108, armor: 16, dodge: 0.09, speedMul: 1.12, physMul: 1.02, specMul: 1.10, regen: 0.3, crit: 0.10 },
      passive: { name: '引火恶犬', desc: '恶系伤害 +10%。击败敌人后回复 4% 最大HP。' },
      moves: ['feintattack', 'snarl', 'crunch', 'darkpulse'],
      ultimate: { name: '地狱火', desc: '喷出黑色的地狱之焰，沿地面蔓延，将敌人拖入灼烧深渊。' },
      chart: { weak: ['fighting', 'ground', 'water', 'rock'], resist: ['ghost', 'dark'], strong: ['psychic', 'ghost'] },
      evo: [{ at: 24, name: '黑鲁加' }]
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
    { id: 'seel', name: '小海狮', type: 'ice', hp: 36, atk: 12, spd: 1.5, xp: 5, sprite: 'seel', size: 19 },
    /* v3 扩充野生池 */
    { id: 'gastly', name: '鬼斯', type: 'ghost', hp: 26, atk: 12, spd: 1.8, xp: 4, sprite: 'gastly', size: 18 },
    { id: 'abra', name: '凯西', type: 'psychic', hp: 22, atk: 13, spd: 2.0, xp: 5, sprite: 'abra', size: 17 },
    { id: 'ekans', name: '阿柏蛇', type: 'poison', hp: 30, atk: 13, spd: 1.7, xp: 4, sprite: 'ekans', size: 19 },
    { id: 'bellsprout', name: '喇叭芽', type: 'grass', hp: 30, atk: 12, spd: 1.4, xp: 4, sprite: 'bellsprout', size: 18 },
    { id: 'poliwag', name: '蚊香蝌蚪', type: 'water', hp: 28, atk: 11, spd: 1.7, xp: 4, sprite: 'poliwag', size: 17 },
    { id: 'voltorb', name: '霹雳电球', type: 'electric', hp: 30, atk: 12, spd: 2.2, xp: 5, sprite: 'voltorb', size: 18 },
    { id: 'cubone', name: '卡拉卡拉', type: 'ground', hp: 38, atk: 15, spd: 1.6, xp: 6, sprite: 'cubone', size: 19 },
    { id: 'koffing', name: '瓦斯弹', type: 'poison', hp: 34, atk: 12, spd: 1.5, xp: 5, sprite: 'koffing', size: 19 },
    { id: 'staryu', name: '海星星', type: 'water', hp: 32, atk: 13, spd: 2.0, xp: 5, sprite: 'staryu', size: 18 },
    { id: 'houndour', name: '戴鲁比', type: 'dark', hp: 36, atk: 15, spd: 2.1, xp: 6, sprite: 'houndour', size: 19 },
    { id: 'magnemite', name: '小磁怪', type: 'electric', hp: 30, atk: 12, spd: 1.9, xp: 5, sprite: 'magnemite', size: 18 },
    { id: 'spearow', name: '烈雀', type: 'flying', hp: 26, atk: 12, spd: 2.4, xp: 4, sprite: 'spearow', size: 17 },
    { id: 'mankey', name: '猴怪', type: 'fighting', hp: 34, atk: 15, spd: 2.0, xp: 5, sprite: 'mankey', size: 19 }
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
    lanturn:    { name: '电灯怪', type: 'water', hp: 1250, atk: 29, spd: 2.6, r: 38, sprite: 'lanturn' },
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

  /* ============================================================
     PvP 镜像对手池：排行榜为空时的内置对手（玩家离线也能 PvP）
     char / level 决定强度，title 是展示称号
     ============================================================ */
  var PVP_RIVALS = [
    { name: '青空训练家', char: 'pikachu', level: 18, title: '疾风三连' },
    { name: '深岩老手', char: 'snorlax', level: 22, title: '厚壁铁壁' },
    { name: '霜语旅人', char: 'seel', level: 20, title: '极寒之息' },
    { name: '赤瞳挑战者', char: 'houndour', level: 24, title: '恶梦猎手' },
    { name: '藤蔓园丁', char: 'bulbasaur', level: 21, title: '生生不息' },
    { name: '熔火教头', char: 'charmander', level: 23, title: '烈焰冲锋' },
    { name: '潮汐守卫', char: 'squirtle', level: 19, title: '不破之壳' },
    { name: '影缝游侠', char: 'gastly', level: 25, title: '夜幕低语' },
    { name: '砂砾行者', char: 'sandshrew', level: 20, title: '大地之牙' },
    { name: '星屑占者', char: 'abra', level: 26, title: '念动风暴' }
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
    PVP_RIVALS: PVP_RIVALS,
    UPGRADES: UPGRADES
  };
})();
