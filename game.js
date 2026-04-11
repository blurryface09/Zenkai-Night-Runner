// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Responsive: fill the actual window on any device
const W        = window.innerWidth;
const H        = window.innerHeight;
const GROUND_Y = H - Math.round(H * 0.1);
const PLAYER_SCALE   = 0.42;
const ENEMY_SCALE    = 0.42;
const BOSS_SCALE     = 0.58;
const PLAYER_MAX_HP  = 5;
const LIVES_MAX      = 3;

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function getLB()  { try { return JSON.parse(localStorage.getItem('lb')||'[]'); } catch{ return []; } }
function saveLB(l){ localStorage.setItem('lb', JSON.stringify(l.slice(0,10))); }
function submitScore(s){ const l=getLB(); l.push({score:s,date:new Date().toLocaleDateString()}); l.sort((a,b)=>b.score-a.score); saveLB(l); }

// ─── SIMPLE AUDIO ─────────────────────────────────────────────────────────────
class Audio {
    constructor(){ this.ctx=null; this.muted=false; this._t=[]; this._bar=0; }

    init(){
        try{
            this.ctx = new (window.AudioContext||window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.35;
            this.master.connect(this.ctx.destination);
            this._tick();
        }catch(e){}
    }

    resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); }

    // One note per beat — zero spike risk
    _tick(){
        if(!this.ctx) return;
        const BPM=108, BEAT=60/BPM;
        const bass=[110,110,131,147,110,98,131,147];
        if(!this.muted){
            try{
                const f=bass[this._bar%bass.length];
                const o=this.ctx.createOscillator(), g=this.ctx.createGain();
                o.type='triangle'; o.frequency.value=f;
                g.gain.setValueAtTime(0.1,this.ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+BEAT*0.75);
                o.connect(g); g.connect(this.master);
                o.start(); o.stop(this.ctx.currentTime+BEAT*0.8);
            }catch(e){}
            // Kick on beats 0 and 2
            if(this._bar%4===0||this._bar%4===2){
                try{
                    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
                    o.type='sine';
                    o.frequency.setValueAtTime(130,this.ctx.currentTime);
                    o.frequency.exponentialRampToValueAtTime(38,this.ctx.currentTime+0.18);
                    g.gain.setValueAtTime(0.4,this.ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+0.22);
                    o.connect(g); g.connect(this.master);
                    o.start(); o.stop(this.ctx.currentTime+0.25);
                }catch(e){}
            }
        }
        this._bar++;
        // Only keep last 4 timer IDs to prevent memory growth
        if(this._t.length > 4) { clearTimeout(this._t.shift()); }
        const id=setTimeout(()=>this._tick(), BEAT*1000);
        this._t.push(id);
    }

    stop(){ this._t.forEach(id=>clearTimeout(id)); this._t=[]; }
    toggleMute(){ this.muted=!this.muted; if(this.ctx) this.master.gain.value=this.muted?0:0.35; return this.muted; }

    _note(f,vol,dur,type='sine'){
        if(!this.ctx||this.muted) return;
        try{
            const o=this.ctx.createOscillator(), g=this.ctx.createGain();
            o.type=type; o.frequency.value=f;
            g.gain.setValueAtTime(vol,this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
            o.connect(g); g.connect(this.master);
            o.start(); o.stop(this.ctx.currentTime+dur+0.05);
        }catch(e){}
    }

    jump()  { this._note(380,0.12,0.15,'sine'); }
    sword() { this._note(800,0.08,0.08,'sawtooth'); setTimeout(()=>this._note(400,0.06,0.1,'sawtooth'),60); }
    hit()   { this._note(180,0.2,0.08,'sawtooth'); }
    kill()  { this._note(520,0.12,0.1,'triangle'); setTimeout(()=>this._note(660,0.1,0.1,'triangle'),80); }
    die()   { [200,160,120,80].forEach((f,i)=>setTimeout(()=>this._note(f,0.18,0.14,'sawtooth'),i*80)); }
}
const SFX = new Audio();

// ─── BOOT ─────────────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
    constructor(){ super({key:'BootScene'}); }
    preload(){
        this.load.spritesheet('ninja','assets/ninja_hq.png',{frameWidth:384,frameHeight:384});
        this.load.spritesheet('enemy','assets/enemy_hq.png',{frameWidth:384,frameHeight:384});
        this.load.spritesheet('boss', 'assets/boss_hq.png', {frameWidth:384,frameHeight:384});
    }
    create(){ this.scene.start('TitleScene'); }
}

// ─── TITLE ────────────────────────────────────────────────────────────────────
class TitleScene extends Phaser.Scene {
    constructor(){ super({key:'TitleScene'}); }
    create(){
        const sky=this.add.graphics();
        sky.fillGradientStyle(0x020510,0x020510,0x091428,0x091428,1);
        sky.fillRect(0,0,W,H);
        for(let i=0;i<100;i++){
            const g=this.add.graphics();
            g.fillStyle(0xffffff,Math.random()*0.7+0.2);
            g.fillCircle(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H*0.7),Math.random()<0.1?1.5:0.6);
        }

        this.add.text(W/2,H*0.20,'NIGHT RUNNER',{fontFamily:'monospace',fontSize:'58px',fontStyle:'bold',color:'#e8f4ff',stroke:'#001133',strokeThickness:8}).setOrigin(0.5);
        this.add.text(W/2,H*0.31,'ZENKAI',{fontFamily:'monospace',fontSize:'26px',color:'#5588ff',stroke:'#000',strokeThickness:4}).setOrigin(0.5);
        this.add.text(W/2,H*0.38,'Fight. Survive. Conquer.',{fontFamily:'monospace',fontSize:'14px',color:'#334466',fontStyle:'italic'}).setOrigin(0.5);
        this.add.text(W/2,H*0.47,'SELECT DIFFICULTY',{fontFamily:'monospace',fontSize:'16px',color:'#667788'}).setOrigin(0.5);

        const diffs=[
            {label:'EASY',  color:'#44ff88',diff:'easy'},
            {label:'NORMAL',color:'#ffcc00',diff:'normal'},
            {label:'HARD',  color:'#ff4444',diff:'hard'},
        ];
        diffs.forEach((d,i)=>{
            const btn=this.add.text(W/2+(i-1)*(W*0.3),H*0.55,d.label,{
                fontFamily:'monospace',fontSize:'20px',fontStyle:'bold',
                color:d.color,backgroundColor:'#0a1428',padding:{x:18,y:10},stroke:'#000',strokeThickness:3
            }).setOrigin(0.5).setInteractive();
            btn.on('pointerover',()=>btn.setAlpha(0.7));
            btn.on('pointerout', ()=>btn.setAlpha(1));
            btn.on('pointerdown',()=>{ SFX.resume(); SFX.init(); this.scene.start('GameScene',{diff:d.diff}); });
        });

        const lb=getLB();
        this.add.text(W/2,H*0.67,'TOP SCORES',{fontFamily:'monospace',fontSize:'14px',color:'#ffcc44'}).setOrigin(0.5);
        if(lb.length===0){
            this.add.text(W/2,H*0.73,'No scores yet',{fontFamily:'monospace',fontSize:'12px',color:'#334455'}).setOrigin(0.5);
        } else {
            lb.slice(0,5).forEach((e,i)=>{
                this.add.text(W/2,H*0.73+i*20,`${i+1}. ${String(e.score).padStart(5,' ')}   ${e.date}`,{
                    fontFamily:'monospace',fontSize:'12px',color:i===0?'#ffaa00':'#778899'
                }).setOrigin(0.5);
            });
        }
    }
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
    constructor(){ super({key:'GameScene'}); }

    init(data){
        const diff=(data&&data.diff)||'normal';
        const cfg={easy:{spd:260,ehp:1,sMin:2200,sMax:3500},normal:{spd:320,ehp:2,sMin:1600,sMax:2800},hard:{spd:380,ehp:2,sMin:1400,sMax:2400}};
        const c=cfg[diff]||cfg.normal;
        this.gameSpeed   = c.spd;
        this.enemyBaseHP = c.ehp;
        this.spawnMin    = c.sMin;
        this.spawnMax    = c.sMax;
        this.spawnTimer  = c.sMax;
        this.score       = 0;
        this.killCount   = 0;
        this.combo       = 0;
        this.comboTime   = 0;
        this.lives       = LIVES_MAX;
        this.playerHP    = PLAYER_MAX_HP;
        this.alive       = true;
        this.paused      = false;
        this.isJumping   = false;
        this.isAttacking = false;
        this.isBlocking  = false;
        this.hpInv       = false;
        this.combatLock  = false;
        this.activeEnemy = null;
        this.bossActive  = false;
        this.bgLayers    = [];
    }

    create(){
        this._buildSky();
        this._buildCity();
        this._buildGround();
        this._buildAnims();
        this._buildPlayer();
        this._buildGroups();
        this._buildUI();
        this._buildInput();
        SFX.init();
        this.time.addEvent({delay:250,loop:true,callback:()=>{ if(this.alive&&!this.combatLock&&!this.paused) this.score++; }});
        this.time.addEvent({delay:10000,loop:true,callback:()=>{ if(this.alive) this.gameSpeed=Math.min(this.gameSpeed+15,560); }});
    }

    // ── SKY + CITY ────────────────────────────────────────────────────────────
    _buildSky(){
        const sky=this.add.graphics().setDepth(0);
        sky.fillGradientStyle(0x020510,0x020510,0x091428,0x091428,1);
        sky.fillRect(0,0,W,H);
        const stars=this.add.graphics().setDepth(1);
        for(let i=0;i<120;i++){
            stars.fillStyle(0xffffff,Math.random()*0.7+0.2);
            stars.fillCircle(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H*0.65),Math.random()<0.1?1.5:0.6);
        }
        const moon=this.add.graphics().setDepth(1);
        moon.fillStyle(0xfff0b0,1); moon.fillCircle(W-130,75,42);
        moon.fillStyle(0x091428,1); moon.fillCircle(W-112,63,36);
    }

    _buildCity(){
        const cfgs=[
            {depth:2,spd:20, minH:70, maxH:180,minW:50,maxW:90, colA:0x060912,colB:0x08101e,winA:0.09},
            {depth:3,spd:60, minH:90, maxH:230,minW:42,maxW:75, colA:0x0b1422,colB:0x10192e,winA:0.16},
            {depth:4,spd:130,minH:100,maxH:250,minW:36,maxW:65, colA:0x131c30,colB:0x182338,winA:0.26},
        ];
        cfgs.forEach(c=>{
            const gA=this._buildingGfx(c), gB=this._buildingGfx(c);
            gA.setDepth(c.depth); gA.x=0;
            gB.setDepth(c.depth); gB.x=W;
            this.bgLayers.push({gA,gB,spd:c.spd});
        });
    }

    _buildingGfx(c){
        const g=this.add.graphics(); let x=0;
        while(x<W+c.maxW){
            const bw=Phaser.Math.Between(c.minW,c.maxW), bh=Phaser.Math.Between(c.minH,c.maxH);
            const by=GROUND_Y-bh;
            g.fillStyle(Math.random()<0.5?c.colA:c.colB,1); g.fillRect(x,by,bw,bh);
            const wc=Math.floor(bw/12), wr=Math.floor(bh/15);
            for(let a=0;a<wc;a++) for(let b=0;b<wr;b++){
                if(Math.random()<0.2){
                    g.fillStyle(Math.random()<0.6?0xffe8a0:0x88aadd, c.winA*Phaser.Math.FloatBetween(0.5,1));
                    g.fillRect(x+a*12+3,by+b*15+4,6,7);
                }
            }
            x+=bw+Phaser.Math.Between(2,8);
        }
        return g;
    }

    _scrollCity(delta){
        const mult=this.combatLock?0:1;
        this.bgLayers.forEach(l=>{
            const d=l.spd*mult*delta/1000;
            l.gA.x-=d; l.gB.x-=d;
            if(l.gA.x<=-W){ l.gA.x=l.gB.x+W; }
            if(l.gB.x<=-W){ l.gB.x=l.gA.x+W; }
        });
    }

    // ── GROUND ────────────────────────────────────────────────────────────────
    _buildGround(){
        const g=this.add.graphics().setDepth(5);
        g.fillStyle(0x0b0f1c,1); g.fillRect(0,GROUND_Y,W,H-GROUND_Y);
        g.fillStyle(0x14192e,1); g.fillRect(0,GROUND_Y,W,4);
        g.lineStyle(1,0x1e3060,0.6); g.lineBetween(0,GROUND_Y,W,GROUND_Y);
        const gr=this.add.rectangle(W/2,GROUND_Y+5,W*4,10,0,0);
        this.physics.add.existing(gr,true);
        this.ground=this.physics.add.staticGroup(); this.ground.add(gr);
    }

    // ── ANIMATIONS ────────────────────────────────────────────────────────────
    _buildAnims(){
        // Remove and recreate every time to avoid stale cache on restart
        const keys=['run','jump','attack','e_run','e_attack','b_run','b_attack'];
        keys.forEach(k=>{ if(this.anims.exists(k)) this.anims.remove(k); });
        const mk=(key,tex,s,e,fps,rep)=>
            this.anims.create({key,frameRate:fps,repeat:rep,frames:this.anims.generateFrameNumbers(tex,{start:s,end:e})});
        mk('run',    'ninja',0,5,  14,-1); mk('jump',    'ninja',6,11, 13,0); mk('attack',  'ninja',12,17,18,0);
        mk('e_run',  'enemy',0,5,  14,-1); mk('e_attack','enemy',12,17, 16,0);
        mk('b_run',  'boss', 0,5,  12,-1); mk('b_attack','boss', 12,17, 14,0);
    }

    // ── PLAYER ────────────────────────────────────────────────────────────────
    _buildPlayer(){
        const sh=384*PLAYER_SCALE;
        this.shadow=this.add.ellipse(180,GROUND_Y+6,60,12,0x000000,0.3).setDepth(9);
        this.player=this.physics.add.sprite(180,GROUND_Y-sh/2,'ninja');
        this.player.setScale(PLAYER_SCALE).setDepth(10).setCollideWorldBounds(true);
        this.player.body.setSize(220,280).setOffset(100,50);
        this.physics.add.collider(this.player,this.ground);
        this.player.play('run');
        // Glow layer — reuse same texture, tinted
        this.glow=this.add.sprite(180,GROUND_Y-sh/2,'ninja');
        this.glow.setScale(PLAYER_SCALE*1.06).setDepth(9).setAlpha(0.18).setTint(0x88ccff);
        // No animation on glow — manually synced to player frame each update
    }

    // ── GROUPS ────────────────────────────────────────────────────────────────
    _buildGroups(){
        this.obstacles=this.physics.add.group();
        this.enemies  =this.physics.add.group();
        this.physics.add.overlap(this.player,this.obstacles,()=>{ if(this.alive) this._takeDamage(2); },null,this);
        this.physics.add.overlap(this.player,this.enemies,()=>{},null,this);
    }

    // ── UI — all static, created once ────────────────────────────────────────
    _buildUI(){
        // Score
        this.scoreTxt=this.add.text(20,16,'SCORE: 0',{fontFamily:'monospace',fontSize:'20px',fontStyle:'bold',color:'#ddeeff',stroke:'#001133',strokeThickness:5}).setDepth(50);
        this.killTxt =this.add.text(20,42,'KILLS: 0',{fontFamily:'monospace',fontSize:'13px',color:'#ff9944',stroke:'#000',strokeThickness:3}).setDepth(50);
        this.add.text(W-10,16,'UP Jump   X Attack',{fontFamily:'monospace',fontSize:'11px',color:'#334455',stroke:'#000',strokeThickness:2}).setOrigin(1,0).setDepth(50);

        // HP bar — static rectangles only
        this.add.text(20,62,'HP',{fontFamily:'monospace',fontSize:'12px',color:'#ff6666',stroke:'#000',strokeThickness:3}).setDepth(50);
        this.add.rectangle(115,70,130,11,0x330000).setDepth(50).setOrigin(0.5);
        this._hpFill=this.add.rectangle(50,70,130,11,0x44ff88).setDepth(51).setOrigin(0,0.5);

        // Lives
        this.livesTxt=this.add.text(20,80,'* * *',{fontFamily:'monospace',fontSize:'15px',color:'#ff4466',stroke:'#000',strokeThickness:3}).setDepth(50);

        // Combo text (hidden)
        this.comboTxt=this.add.text(W/2,H*0.17,'',{fontFamily:'monospace',fontSize:'30px',fontStyle:'bold',color:'#ffdd00',stroke:'#552200',strokeThickness:5}).setOrigin(0.5).setDepth(55).setAlpha(0);

        // Fight indicator (hidden)
        this.fightTxt=this.add.text(W/2,22,'FIGHT!',{fontFamily:'monospace',fontSize:'16px',color:'#ffcc00',stroke:'#000',strokeThickness:4}).setOrigin(0.5,0).setDepth(50).setAlpha(0);

        // Streak (hidden)
        this.streakTxt=this.add.text(W/2,H*0.28,'',{fontFamily:'monospace',fontSize:'24px',fontStyle:'bold',color:'#ff4444',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(55).setAlpha(0);

        // Mobile buttons — plain text, no emoji
        // JUMP button — left side
        const jBtn=this.add.text(W*0.25,H-H*0.06,'JUMP',{fontFamily:'monospace',fontSize:'20px',fontStyle:'bold',color:'#88aadd',backgroundColor:'#09101e',padding:{x:22,y:14},stroke:'#1a3060',strokeThickness:2}).setDepth(50).setInteractive().setOrigin(0.5);
        jBtn.on('pointerdown',()=>{ SFX.resume(); this._doJump(); });

        const aBtn=this.add.text(W*0.85,H-H*0.06,'ATTACK',{fontFamily:'monospace',fontSize:'18px',color:'#ff9944',backgroundColor:'#1a0800',padding:{x:14,y:10},stroke:'#aa4400',strokeThickness:2}).setDepth(50).setInteractive().setOrigin(0.5);
        aBtn.on('pointerdown',()=>{ SFX.resume(); this._doAttack(); this.tweens.add({targets:aBtn,scaleX:0.9,scaleY:0.9,duration:80,yoyo:true}); });

        // Mute
        this.muteTxt=this.add.text(W-10,H*0.97,'[MUTE]',{fontFamily:'monospace',fontSize:'12px',color:'#334455',stroke:'#000',strokeThickness:2}).setOrigin(1,0).setDepth(50).setInteractive();
        this.muteTxt.on('pointerdown',()=>{ SFX.resume(); const m=SFX.toggleMute(); this.muteTxt.setText(m?'[UNMUTE]':'[MUTE]'); });
    }

    _updateHP(){
        const pct=Math.max(0,this.playerHP/PLAYER_MAX_HP);
        const col=pct>0.5?0x44ff88:pct>0.25?0xffaa00:0xff3333;
        this._hpFill.setSize(130*pct,11); this._hpFill.setFillStyle(col);
    }

    // ── INPUT ─────────────────────────────────────────────────────────────────
    _buildInput(){
        this.cursors=this.input.keyboard.createCursorKeys();
        this.xKey   =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.pKey   =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.escKey =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard.once('keydown',()=>SFX.resume());
    }


    // ── ACTIONS ───────────────────────────────────────────────────────────────
    _doJump(){
        if(!this.player.body.blocked.down) return;
        this.player.setVelocityY(-820); this.isJumping=true; SFX.jump();
        this.player.play('jump',true);
        if(this._jTimer) this._jTimer.remove();
        this._jTimer=this.time.delayedCall(700,()=>{ this.isJumping=false; if(!this.isAttacking) this.player.play('run',true); });
    }

    _doAttack(){
        if(this.isAttacking) return;
        this.isAttacking=true; this.isBlocking=true; SFX.sword();
        this.player.play('attack',true);
        // Check hit
        this.time.delayedCall(150,()=>{
            this.enemies.getChildren().forEach(en=>{
                if(!en.active) return;
                // Use X distance only — more reliable for side-scrollers
                // Boss is bigger so needs wider range
                const hitRange = en.isBoss ? 320 : 200;
                const xDist = Math.abs(this.player.x - en.x);
                const yDist = Math.abs(this.player.y - en.y);
                if(xDist < hitRange && yDist < 200) this._hitEnemy(en);
            });
        });
        if(this._aTimer) this._aTimer.remove();
        this._aTimer=this.time.delayedCall(350,()=>{ this.isAttacking=false; this.isBlocking=false; if(!this.isJumping) this.player.play('run',true); });
    }

    // ── DAMAGE ────────────────────────────────────────────────────────────────
    _takeDamage(amt){
        if(!this.alive||this.hpInv) return;
        this.playerHP-=amt; SFX.hit();
        this.hpInv=true;
        this.combo=0; this.comboTxt.setAlpha(0);
        this.time.delayedCall(450,()=>{ this.hpInv=false; });
        this.tweens.add({targets:this.player,tint:0xff2222,duration:100,yoyo:true,onComplete:()=>this.player.clearTint()});
        if(this.playerHP<=0){
            this.playerHP=0; this.lives--;
            this._updateLives();
            if(this.lives<=0){ SFX.die(); this._gameOver(); }
            else{
                this.playerHP=PLAYER_MAX_HP; this.hpInv=true;
                this.time.delayedCall(2000,()=>{ this.hpInv=false; });
                this.tweens.add({targets:this.player,alpha:0.3,duration:180,yoyo:true,repeat:5,onComplete:()=>this.player.setAlpha(1)});
                // Simple text flash
                const t=this.add.text(W/2,H/2-40,'LIFE LOST!',{fontFamily:'monospace',fontSize:'34px',fontStyle:'bold',color:'#ff4444',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setDepth(80);
                this.tweens.add({targets:t,y:t.y-60,alpha:0,duration:1000,onComplete:()=>t.destroy()});
            }
        }
    }

    _updateLives(){
        this.livesTxt.setText('* '.repeat(this.lives).trim()||'x');
    }

    // ── ENEMY LOGIC ───────────────────────────────────────────────────────────
    _hitEnemy(en){
        if(!en||!en.active||en.hp<=0) return;
        en.hp--;
        this._refreshEnemyBar(en);
        this.tweens.add({targets:en,alpha:0.2,duration:60,yoyo:true});


        if(en.hp<=0){
            SFX.kill();
            this.cameras.main.shake(80, 0.004);
            this.killCount++;
            this.combo++;
            this.comboTime=this.time.now;
            const pts=10*Math.max(1,this.combo);
            this.score+=pts;
    
            // Floating score — created once, destroyed after tween
            const ft=this.add.text(en.x,en.y-30,'+'+pts,{fontFamily:'monospace',fontSize:this.combo>=3?'24px':'16px',color:this.combo>=3?'#ff8800':'#ffdd00',stroke:'#000',strokeThickness:4}).setDepth(30);
            this.tweens.add({targets:ft,y:ft.y-50,alpha:0,duration:650,onComplete:()=>ft.destroy()});

            // Combo display
            if(this.combo>=2){
                this.comboTxt.setText(this.combo+'x COMBO!');
                this.comboTxt.setColor(this.combo>=5?'#ff4444':this.combo>=3?'#ff9900':'#ffdd00');
                this.comboTxt.setAlpha(1).setScale(1.2);
                this.tweens.add({targets:this.comboTxt,scaleX:1,scaleY:1,duration:180,ease:'Back.Out'});
                this.tweens.add({targets:this.comboTxt,alpha:0,delay:1500,duration:400});
            }

            // Streak announcements — deferred to avoid same-frame overload
            const streaks={3:'TRIPLE KILL!',5:'KILLING SPREE!',10:'UNSTOPPABLE!',20:'LEGENDARY!'};
            if(streaks[this.killCount]){
                const msg=streaks[this.killCount];
                this.time.delayedCall(50,()=>{
                    if(!this.alive||!this.streakTxt) return;
                    this.streakTxt.setText(msg).setAlpha(1).setScale(1.3);
                    this.tweens.add({targets:this.streakTxt,scaleX:1,scaleY:1,duration:200,ease:'Back.Out'});
                    this.tweens.add({targets:this.streakTxt,alpha:0,delay:1400,duration:500});
                });
            }

            // Clean up enemy
            if(en.hpBg)  en.hpBg.destroy();
            if(en.hpBar) en.hpBar.destroy();
            if(en._lbl)  en._lbl.destroy();
            en.destroy();

            if(this.activeEnemy===en){
                this.activeEnemy=null; this.combatLock=false;
                this.tweens.add({targets:this.fightTxt,alpha:0,duration:250});
            }
            if(en.isBoss){
                this.bossActive=false;
                this.score+=50;

                const v=this.add.text(W/2,H/2-50,'CLOWN BOSS DEFEATED! +50',{fontFamily:'monospace',fontSize:'28px',fontStyle:'bold',color:'#ff8800',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setDepth(80);
                this.tweens.add({targets:v,y:v.y-70,alpha:0,delay:300,duration:1400,onComplete:()=>v.destroy()});
                    }

            // Boss every 10 kills — defer to next frame to avoid same-frame crash
            if(this.killCount>0&&this.killCount%10===0&&!this.bossActive){
                this._spawnBoss();
            }
        }
    }

    _enemyAttack(en){
        if(!this.alive||!en.active) return;
        const now = this.time.now;
        const cooldown = en.isBoss ? 2000 : 1600;
        if(en._lastAtk && now - en._lastAtk < cooldown) return;
        en._lastAtk = now;

        const ak = en.isBoss ? 'b_attack' : 'e_attack';
        const rk = en.isBoss ? 'b_run'    : 'e_run';

        // Play attack animation
        en.play(ak, true);

        // Return to run after animation duration
        const fps    = en.isBoss ? 14 : 16;
        const atkDur = (6 / fps) * 1000 + 100;
        this.time.delayedCall(atkDur, ()=>{
            if(en && en.active) en.play(rk, true);
        });

        // Deal damage at midpoint
        this.time.delayedCall(atkDur * 0.5, ()=>{
            if(!this.alive || !en || !en.active) return;
            if(this.isAttacking || this.isBlocking){
                const b = this.add.text(
                    this.player.x, this.player.y - 80, 'BLOCKED!',
                    {fontFamily:'monospace',fontSize:'14px',color:'#44ffaa',stroke:'#000',strokeThickness:4}
                ).setDepth(30);
                this.tweens.add({targets:b, y:b.y-35, alpha:0, duration:500, onComplete:()=>b.destroy()});
            } else {
                this._takeDamage(1);
            }
        });
    }

    // ── ENEMY HP BARS — created once, updated cheaply ─────────────────────────
    _createEnemyBar(en){
        const bw=en.isBoss?76:42, bh=en.isBoss?9:5;
        en._bw=bw; en._bh=bh; en._bmx=en.isBoss?en.maxHp:this.enemyBaseHP;
        const sc=en.isBoss?BOSS_SCALE:ENEMY_SCALE;
        const by=en.y-(384*sc*0.5)-14;
        en.hpBg =this.add.rectangle(en.x,by,bw,bh,0x1a0000).setDepth(15).setOrigin(0.5);
        en.hpBar=this.add.rectangle(en.x-bw/2,by,bw,bh,0xff3333).setDepth(16).setOrigin(0,0.5);
    }

    _refreshEnemyBar(en){
        if(!en||!en.active||!en.hpBg||!en.hpBar) return;
        const sc  =en.isBoss?BOSS_SCALE:ENEMY_SCALE;
        const by  =en.y-(384*sc*0.5)-14;
        const pct =Math.max(0,en.hp/en._bmx);
        const col =en.isBoss?(pct>0.5?0xff6600:pct>0.25?0xff2200:0xff0000):(pct>0.5?0xff3333:0xff0000);
        en.hpBg.setPosition(en.x,by);
        en.hpBar.setPosition(en.x-en._bw/2,by);
        en.hpBar.setSize(en._bw*pct,en._bh);
        en.hpBar.setFillStyle(col);
    }

    // ── SPAWNING ──────────────────────────────────────────────────────────────
    _spawnObstacle(){
        if(this.combatLock) return;
        const t=Phaser.Math.Between(0,2);
        const [w,h,col]=t===0?[36,44,0x6a2808]:t===1?[16,88,0x1a2844]:[50,26,0x580c0c];
        const ob=this.add.rectangle(W+80,GROUND_Y-h/2,w,h,col);
        this.physics.add.existing(ob);
        ob.body.setAllowGravity(false); ob.body.setVelocityX(-this.gameSpeed);
        ob.setDepth(8); this.obstacles.add(ob);
    }

    _spawnEnemy(){
        if(this.combatLock||this.bossActive||this.enemies.getLength()>=2) return;
        const sh=384*ENEMY_SCALE;
        const en=this.physics.add.sprite(W+80,GROUND_Y-sh/2,'enemy');
        en.setScale(ENEMY_SCALE).setFlipX(true).setDepth(9);
        en.hp=this.enemyBaseHP; en.maxHp=this.enemyBaseHP; en.isBoss=false;
        en.body.setSize(140,273).setOffset(85,45);
        en.body.setAllowGravity(true); en.body.setVelocityX(-this.gameSpeed*0.78);
        this.physics.add.collider(en,this.ground);
        this.enemies.add(en); en.play('e_run');
        this._createEnemyBar(en);
    }

    _spawnBoss(){
        if(this.bossActive) return;
        this.bossActive  = true;
        // Unlock combat so boss can engage properly
        this.combatLock  = false;
        this.activeEnemy = null;
        this.fightTxt.setAlpha(0);

        const sh   = 384 * BOSS_SCALE;
        const boss = this.physics.add.sprite(W + 100, GROUND_Y - sh/2, 'boss');
        boss.setScale(BOSS_SCALE).setFlipX(true).setDepth(9);
        const mhp  = 8 + Math.floor(this.killCount / 10) * 2;
        boss.hp    = mhp;
        boss.maxHp = mhp;
        boss.isBoss = true;
        boss.body.setSize(220, 320).setOffset(80, 40);
        boss.body.setAllowGravity(true);
        boss.body.setVelocityX(-this.gameSpeed * 0.45);
        this.physics.add.collider(boss, this.ground);
        this.enemies.add(boss);
        boss.play('b_run');
        this._createEnemyBar(boss);
        boss._lbl = this.add.text(
            boss.x, GROUND_Y - sh - 8, 'CLOWN BOSS',
            {fontFamily:'monospace', fontSize:'12px', color:'#ff4400'}
        ).setDepth(17).setOrigin(0.5);
    }

    // ── PAUSE ─────────────────────────────────────────────────────────────────
    _togglePause(){
        this.paused=!this.paused;
        if(this.paused){
            this.physics.pause();
            if(!this._pOvr){
                this._pOvr=this.add.rectangle(W/2,H/2,400,160,0x000000,0.88).setDepth(200);
                this._pTxt=this.add.text(W/2,H/2-20,'PAUSED',{fontFamily:'monospace',fontSize:'38px',color:'#ffffff',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setDepth(201);
                this._pSub=this.add.text(W/2,H/2+28,'Press P or ESC to resume',{fontFamily:'monospace',fontSize:'14px',color:'#8899aa'}).setOrigin(0.5).setDepth(201);
            }
            this._pOvr.setVisible(true); this._pTxt.setVisible(true); this._pSub.setVisible(true);
        } else {
            this.physics.resume();
            if(this._pOvr){ this._pOvr.setVisible(false); this._pTxt.setVisible(false); this._pSub.setVisible(false); }
        }
    }

    // ── GAME OVER ─────────────────────────────────────────────────────────────
    _gameOver(){
        if(!this.alive) return;
        this.alive=false; this.physics.pause(); SFX.stop();
        submitScore(this.score);
        const lb=getLB();
        this.add.rectangle(W/2,H/2,520,440,0x000000,0.93).setDepth(100);
        this.add.text(W/2,H/2-185,'GAME OVER',{fontFamily:'monospace',fontSize:'40px',color:'#ff4444',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setDepth(101);
        this.add.text(W/2,H/2-135,'SCORE: '+this.score+'   KILLS: '+this.killCount,{fontFamily:'monospace',fontSize:'18px',color:'#ffffff',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(101);
        this.add.text(W/2,H/2-95,'LEADERBOARD',{fontFamily:'monospace',fontSize:'13px',color:'#ffcc44'}).setOrigin(0.5).setDepth(101);
        lb.slice(0,8).forEach((e,i)=>{
            const you=e.score===this.score&&i===lb.findIndex(x=>x.score===this.score);
            this.add.text(W/2,H/2-68+i*24,`${i+1}. ${String(e.score).padStart(6,' ')}   ${e.date}`,{fontFamily:'monospace',fontSize:'12px',color:you?'#ffee44':i===0?'#ffaa00':'#8899aa',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(101);
        });
        const rb=this.add.text(W/2,H/2+148,'CLICK OR SPACE TO RESTART',{fontFamily:'monospace',fontSize:'14px',color:'#88bbff',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(101).setInteractive();
        rb.on('pointerover',()=>rb.setColor('#ffffff')); rb.on('pointerout',()=>rb.setColor('#88bbff'));
        rb.on('pointerdown',()=>{ SFX.init(); this.scene.start('TitleScene'); });
        this.input.keyboard.once('keydown-SPACE',()=>{ SFX.init(); this.scene.start('TitleScene'); });
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    update(time,delta){
        if(!this.alive) return;

        // Pause
        if(Phaser.Input.Keyboard.JustDown(this.pKey)||Phaser.Input.Keyboard.JustDown(this.escKey)) this._togglePause();
        if(this.paused) return;

        // Combo timeout
        if(this.combo>0&&time-this.comboTime>3000){ this.combo=0; this.comboTxt.setAlpha(0); }

        // Safety unstick — only reset timer when state CHANGES, not every frame
        const stateNow = this.isAttacking ? 'atk' : this.isJumping ? 'jmp' : 'run';
        if(stateNow !== this._lastState){
            this._lastState = stateNow;
            this._stuckT    = time;
        }
        if(this.isAttacking && time - this._stuckT > 1200){
            this.isAttacking=false; this.isBlocking=false;
            this._stuckT=time; this._lastState='run';
            this.player.play('run',true);
        }

        this._scrollCity(delta);

        // Input
        if(Phaser.Input.Keyboard.JustDown(this.cursors.up)) this._doJump();
        if(Phaser.Input.Keyboard.JustDown(this.xKey))       this._doAttack();


        // Auto run
        if(this.player.body.blocked.down&&!this.isJumping&&!this.isAttacking)
            if(this.player.anims.currentAnim?.key!=='run') this.player.play('run',true);

        // Sync glow + shadow
        this.glow.setPosition(this.player.x,this.player.y);
        try{ this.glow.setFrame(this.player.anims.currentFrame ? this.player.anims.currentFrame.index : 0); }catch(e){}
        this.glow.setAlpha(this.isAttacking?0.35:0.18);
        this.glow.setTint(this.isAttacking?0xffaa44:0x88ccff);
        this.shadow.setPosition(this.player.x,GROUND_Y+6);

        // Obstacles
        this.obstacles.getChildren().forEach(ob=>{
            if(ob.body) ob.body.setVelocityX(this.combatLock?0:-this.gameSpeed);
            if(ob.x<-120) ob.destroy();
        });

        // Enemies
        this.enemies.getChildren().forEach(en=>{
            if(!en.active) return;
            const dist=Phaser.Math.Distance.Between(this.player.x,this.player.y,en.x,en.y);
            const lockR=en.isBoss?270:210;

            if(dist<lockR&&!this.combatLock){
                this.combatLock=true; this.activeEnemy=en;
                this.fightTxt.setAlpha(1);
                this.tweens.add({targets:this.fightTxt,scaleX:1.15,scaleY:1.15,duration:120,yoyo:true,repeat:1});
            }

            if(this.combatLock&&en===this.activeEnemy){
                // Move toward combat position
                const tx=this.player.x+(en.isBoss?160:130), dx=en.x-tx;
                en.body.setVelocityX(dx>20?-80:dx<-20?80:0);
                // Attack whenever in combat — no distance check needed
                this._enemyAttack(en);
            } else if(!this.combatLock){
                en.body.setVelocityX(-this.gameSpeed*0.75);
            }

            // Update bar position cheaply
            this._refreshEnemyBar(en);
            if(en._lbl) en._lbl.setPosition(en.x, en.y-(384*(en.isBoss?BOSS_SCALE:ENEMY_SCALE)*0.5)-14);

            if(en.x<-120){
                if(en.hpBg)  en.hpBg.destroy();
                if(en.hpBar) en.hpBar.destroy();
                if(en._lbl)  en._lbl.destroy();
                if(this.activeEnemy===en){ this.activeEnemy=null; this.combatLock=false; this.fightTxt.setAlpha(0); }
                if(en.isBoss) this.bossActive=false;
                en.destroy();
            }
        });

        // Spawn
        this.spawnTimer-=delta;
        if(this.spawnTimer<=0){
            if(!this.combatLock) Math.random()<0.38?this._spawnObstacle():this._spawnEnemy();
            this.spawnTimer=Phaser.Math.Between(this.spawnMin,this.spawnMax);
        }

        this._updateHP();
        this.scoreTxt.setText('SCORE: '+this.score);
        const nb=10-(this.killCount%10);
        this.killTxt.setText('KILLS: '+this.killCount+(this.bossActive?' [BOSS!]':nb<=3?' (boss in '+nb+')':''));
        this.killTxt.setColor(this.bossActive?'#ff4400':nb<=3?'#ffcc00':'#ff9944');
    }
}

// ─── LAUNCH ───────────────────────────────────────────────────────────────────
new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#020510',
    antialias: true,
    width: W,
    height: H,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: { default:'arcade', arcade:{ gravity:{y:1800}, debug:false } },
    scene: [BootScene, TitleScene, GameScene]
});
