var GameScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function() {
    Phaser.Scene.call(this, { key: 'GameScene' });
    this._ready = false;
    this._pendingStart = null;
    this._remotePlayers = {};  // playerId → { sprite, nameText, data }
    this._myPlayer = null;
    this._cursors = null;
    this._moveTimer = 0;
    this._cityMap = null;
    this._npcs = [];
    this._cars = [];
  },

  create: function() {
    var self = this;
    var W = CFG.WORLD_W * CFG.TILE;
    var H = CFG.WORLD_H * CFG.TILE;

    self._cityMap = self.registry.get('cityMap');

    // Background: city image
    self.add.image(W/2, H/2, 'city');

    // World bounds
    self.physics.world.setBounds(0, 0, W, H);
    self.cameras.main.setBounds(0, 0, W, H);

    // Input
    self._cursors = self.input.keyboard.createCursorKeys();
    self._wasd = self.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // NPC pedestrians
    self._spawnNPCs();

    // Cars
    self._spawnCars();

    // Socket: incoming remote player events
    SC.on('game_state_init', function(d) {
      self._initSelf(d.self);
      d.others.forEach(function(ps) { self._addRemotePlayer(ps); });
      self._ready = true;
    });

    SC.on('player_joined_game', function(ps) {
      self._addRemotePlayer(ps);
    });

    SC.on('player_left_game', function(d) {
      self._removeRemotePlayer(d.playerId);
    });

    SC.on('player_moved', function(d) {
      self._updateRemotePlayer(d);
    });

    SC.on('position_correction', function(d) {
      if (self._myPlayer) {
        self._myPlayer.sprite.x = d.x;
        self._myPlayer.sprite.y = d.y;
      }
    });

    // If startPhaserGame was already called before scene was ready
    if (self._pendingStart) {
      self._doStart(self._pendingStart);
      self._pendingStart = null;
    }

    // Expose start hook for UI
    window.startPhaserGame = function(data) {
      if (self._ready !== null) {
        self._doStart(data);
      } else {
        self._pendingStart = data;
      }
    };
  },

  _doStart: function(data) {
    var self = this;
    self._charId = data.characterId || 0;
    self._spec = data.specialization || 'TECH';
    self._playerData = data.player || {};

    SC.emit('player_ready', {
      characterId: self._charId,
      specialization: self._spec,
      username: self._playerData.username || 'Player',
    });
  },

  _initSelf: function(ps) {
    var self = this;
    if (self._myPlayer) {
      self._myPlayer.sprite.destroy();
      self._myPlayer.nameText.destroy();
    }

    var sprite = self.physics.add.image(ps.x, ps.y, 'player_' + ps.characterId);
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(10);

    var nameText = self.add.text(ps.x, ps.y - 22, ps.username, {
      fontSize: '9px', fontFamily: "'Press Start 2P'",
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);

    self._myPlayer = {
      sprite: sprite,
      nameText: nameText,
      data: ps,
      vx: 0, vy: 0,
    };

    self.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    self._updateHUD(ps);
  },

  _addRemotePlayer: function(ps) {
    var self = this;
    if (self._remotePlayers[ps.playerId]) return;

    var sprite = self.add.image(ps.x, ps.y, 'player_' + ps.characterId);
    sprite.setDepth(9);
    sprite.setAlpha(0.85);

    var nameText = self.add.text(ps.x, ps.y - 22, ps.username, {
      fontSize: '9px', fontFamily: "'Press Start 2P'",
      color: '#dddddd', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    self._remotePlayers[ps.playerId] = { sprite: sprite, nameText: nameText, data: ps };
  },

  _removeRemotePlayer: function(playerId) {
    var rp = this._remotePlayers[playerId];
    if (!rp) return;
    rp.sprite.destroy();
    rp.nameText.destroy();
    delete this._remotePlayers[playerId];
  },

  _updateRemotePlayer: function(d) {
    var rp = this._remotePlayers[d.playerId];
    if (!rp) return;
    // Lerp to target position
    rp.data.targetX = d.x;
    rp.data.targetY = d.y;
    rp.data.direction = d.direction;
    rp.data.moving = d.moving;
    if (!rp.data.targetX) { rp.sprite.x = d.x; rp.sprite.y = d.y; }
  },

  update: function(time, delta) {
    var self = this;
    var dt = delta / 1000;

    // NPC movement
    self._updateNPCs(dt);
    self._updateCars(dt);

    if (!self._myPlayer) return;

    // Player movement
    var sp = self._myPlayer.sprite;
    var vx = 0, vy = 0;
    var cur = self._cursors;
    var wasd = self._wasd;

    if (cur.left.isDown  || wasd.left.isDown)  vx = -CFG.SPEED;
    if (cur.right.isDown || wasd.right.isDown) vx =  CFG.SPEED;
    if (cur.up.isDown    || wasd.up.isDown)    vy = -CFG.SPEED;
    if (cur.down.isDown  || wasd.down.isDown)  vy =  CFG.SPEED;

    // Diagonal normalization
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    var moving = vx !== 0 || vy !== 0;
    var direction = self._myPlayer.data.direction || 'down';
    if (vy < 0) direction = 'up';
    else if (vy > 0) direction = 'down';
    else if (vx < 0) direction = 'left';
    else if (vx > 0) direction = 'right';

    // Collision check before moving
    var nx = sp.x + vx * dt;
    var ny = sp.y + vy * dt;
    if (self._canWalk(nx, sp.y)) sp.x = nx;
    if (self._canWalk(sp.x, ny)) sp.y = ny;

    // Rotate sprite based on direction
    var angles = { up: -90, down: 90, left: 180, right: 0 };
    sp.angle = angles[direction] || 90;

    // Update name tag position
    self._myPlayer.nameText.x = sp.x;
    self._myPlayer.nameText.y = sp.y - 22;

    // Drain stats
    var ps = self._myPlayer.data;
    if (moving) {
      ps.food = Math.max(0, ps.food - CFG.DRAIN.FOOD_WALK * dt);
    } else {
      ps.food = Math.max(0, ps.food - CFG.DRAIN.FOOD_IDLE * dt);
    }
    if (ps.food <= 0) {
      ps.health = Math.max(0, ps.health - CFG.DRAIN.HEALTH_EMPTY * dt);
    }
    self._updateHUD(ps);

    // Update remote player positions (lerp)
    Object.keys(self._remotePlayers).forEach(function(pid) {
      var rp = self._remotePlayers[pid];
      if (rp.data.targetX !== undefined) {
        rp.sprite.x += (rp.data.targetX - rp.sprite.x) * 0.18;
        rp.sprite.y += (rp.data.targetY - rp.sprite.y) * 0.18;
        rp.nameText.x = rp.sprite.x;
        rp.nameText.y = rp.sprite.y - 22;
      }
    });

    // Send position to server at ~15fps
    self._moveTimer += delta;
    if (self._moveTimer >= 67) {
      self._moveTimer = 0;
      SC.emit('player_move', {
        x: sp.x,
        y: sp.y,
        direction: direction,
        moving: moving,
      });
    }
  },

  _canWalk: function(x, y) {
    var TILE = CFG.TILE;
    var map = this._cityMap;
    if (!map) return true;

    var half = 10; // collision radius
    var checks = [
      [x - half, y - half],
      [x + half, y - half],
      [x - half, y + half],
      [x + half, y + half],
    ];

    for (var i = 0; i < checks.length; i++) {
      var tx = Math.floor(checks[i][0] / TILE);
      var ty = Math.floor(checks[i][1] / TILE);
      if (tx < 0 || ty < 0 || tx >= CFG.WORLD_W || ty >= CFG.WORLD_H) return false;
      if (!CFG.WALKABLE.has(map[ty][tx])) return false;
    }
    return true;
  },

  _updateHUD: function(ps) {
    if (window.UI) UI.updateHUD(ps);
  },

  _spawnNPCs: function() {
    var self = this;
    // Waypoint paths on sidewalks (hardcoded routes)
    var routes = [
      // Route along horizontal road sidewalk
      [{x:320,y:230},{x:700,y:230},{x:700,y:232},{x:320,y:232}],
      [{x:900,y:780},{x:1300,y:780},{x:1300,y:782},{x:900,y:782}],
      [{x:400,y:826},{x:800,y:826},{x:800,y:828},{x:400,y:828}],
      [{x:200,y:1290},{x:600,y:1290},{x:600,y:1292},{x:200,y:1292}],
    ];

    routes.forEach(function(route, ri) {
      var npc = {
        sprite: self.add.image(route[0].x, route[0].y, 'npc').setDepth(8).setAlpha(0.8),
        route: route,
        waypointIdx: 0,
        speed: 40 + ri * 5,
      };
      self._npcs.push(npc);
    });
  },

  _updateNPCs: function(dt) {
    var self = this;
    self._npcs.forEach(function(npc) {
      var target = npc.route[npc.waypointIdx];
      var dx = target.x - npc.sprite.x;
      var dy = target.y - npc.sprite.y;
      var dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 2) {
        npc.waypointIdx = (npc.waypointIdx + 1) % npc.route.length;
        return;
      }

      npc.sprite.x += (dx / dist) * npc.speed * dt;
      npc.sprite.y += (dy / dist) * npc.speed * dt;
    });
  },

  _spawnCars: function() {
    var self = this;
    // Cars driving along road rows
    var carDefs = [
      { x: 200, y: 272, vx: 60, vy: 0, carIdx: 0, minX: 0, maxX: 2240 },
      { x: 1200, y: 288, vx: -50, vy: 0, carIdx: 1, minX: 0, maxX: 2240 },
      { x: 100, y: 800, vx: 70, vy: 0, carIdx: 2, minX: 0, maxX: 2240 },
      { x: 700, y: 816, vx: -45, vy: 0, carIdx: 3, minX: 0, maxX: 2240 },
      { x: 400, y: 1312, vx: 55, vy: 0, carIdx: 4, minX: 0, maxX: 2240 },
    ];

    carDefs.forEach(function(def) {
      var sprite = self.add.image(def.x, def.y, 'car_' + def.carIdx).setDepth(7);
      if (def.vx < 0) sprite.flipX = true;
      self._cars.push({ sprite: sprite, vx: def.vx, vy: def.vy, minX: def.minX, maxX: def.maxX });
    });
  },

  _updateCars: function(dt) {
    var W = CFG.WORLD_W * CFG.TILE;
    this._cars.forEach(function(car) {
      car.sprite.x += car.vx * dt;
      car.sprite.y += car.vy * dt;

      // Wrap around
      if (car.vx > 0 && car.sprite.x > W + 50) car.sprite.x = -50;
      if (car.vx < 0 && car.sprite.x < -50) car.sprite.x = W + 50;
    });
  },
});
