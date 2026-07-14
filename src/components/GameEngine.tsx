import React, { useEffect, useRef, useState } from 'react';
import { GameConfig } from '../templates/gameTemplates';
import { sounds } from '../utils/sound';

interface GameEngineProps {
  config: GameConfig;
  isEditing: boolean;
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onWin?: () => void;
  onGameOver?: () => void;
}

export const GameEngine: React.FC<GameEngineProps> = ({
  config,
  isEditing,
  onScoreChange,
  onLivesChange,
  onWin,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);

  // Game state references to avoid stale closures in loop
  const scoreRef = useRef(0);
  const livesRef = useRef(config.maxLives);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Player position/physics
  const playerRef = useRef({
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    width: config.playerSize,
    height: config.playerSize,
    isGrounded: false,
    hasKey: false,
    facing: 'right' as 'left' | 'right',
    isAttacking: false,
    attackCooldown: 0,
  });

  // Level grid copy for modification in-game (like collecting coins, opening doors)
  const [activeGrid, setActiveGrid] = useState<number[][]>(() => JSON.parse(JSON.stringify(config.grid)));
  const gridRef = useRef<number[][]>(activeGrid);

  // Entities & dynamic assets
  const enemiesRef = useRef<{ x: number; y: number; vx: number; vy: number; width: number; height: number; patX?: number; originX?: number; hp?: number }[]>([]);
  const bulletsRef = useRef<{ x: number; y: number; vx: number; vy: number; radius: number; fromPlayer: boolean }[]>([]);

  // Arcade Ball properties
  const ballRef = useRef({ x: 200, y: 250, vx: 3, vy: -3, radius: 8 });

  // Strategy Defense towers & marching enemies
  const towersRef = useRef<{ x: number; y: number; cooldown: number }[]>([]);
  const marchersRef = useRef<{ x: number; y: number; targetIdx: number; hp: number }[]>([]);
  const strategySpawnTimer = useRef(0);

  // Runner distance/score timer
  const runnerTimer = useRef(0);

  // Racing track position
  const racingDistance = useRef(0);

  // Sync state changes with parent component
  const updateScore = (val: number) => {
    scoreRef.current = val;
    if (onScoreChange) onScoreChange(val);
  };

  const updateLives = (val: number) => {
    livesRef.current = val;
    if (onLivesChange) onLivesChange(val);
  };

  // Keep ref of isPlaying up-to-date
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      resetGame();
    }
  }, [isPlaying]);

  // Restart/reset game state based on selected template
  const resetGame = () => {
    const freshGrid = JSON.parse(JSON.stringify(config.grid));
    setActiveGrid(freshGrid);
    gridRef.current = freshGrid;

    updateScore(0);
    updateLives(config.maxLives);
    bulletsRef.current = [];
    towersRef.current = [];
    marchersRef.current = [];
    strategySpawnTimer.current = 0;
    runnerTimer.current = 0;
    racingDistance.current = 0;

    // Scan grid to find Spawn Points, Coins, Enemies etc.
    let spawnX = 50;
    let spawnY = 300;
    const enemies: typeof enemiesRef.current = [];

    const cellWidth = 800 / 24;
    const cellHeight = 450 / 16;

    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 24; c++) {
        const val = freshGrid[r][c];
        if (val === 9) { // Player spawn
          spawnX = c * cellWidth + cellWidth / 2 - config.playerSize / 2;
          spawnY = r * cellHeight + cellHeight / 2 - config.playerSize / 2;
          // Clear spawn point from visual grid so we draw custom sprite
          freshGrid[r][c] = 0;
        } else if (val === 4) { // Enemy spawn
          enemies.push({
            x: c * cellWidth + cellWidth / 2 - 12,
            y: r * cellHeight + cellHeight / 2 - 12,
            vx: config.enemySpeed || 1.5,
            vy: 0,
            width: 24,
            height: 24,
            originX: c * cellWidth + cellWidth / 2 - 12,
            patX: 100, // Patrol range
            hp: 1,
          });
          freshGrid[r][c] = 0;
        } else if (val === 8) { // Strategy Tower
          towersRef.current.push({
            x: c * cellWidth + cellWidth / 2,
            y: r * cellHeight + cellHeight / 2,
            cooldown: 0,
          });
        }
      }
    }

    playerRef.current = {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      width: config.playerSize,
      height: config.playerSize,
      isGrounded: false,
      hasKey: false,
      facing: 'right',
      isAttacking: false,
      attackCooldown: 0,
    };

    enemiesRef.current = enemies;

    // Ball initial location for arcade breakout
    if (config.type === 'arcade') {
      ballRef.current = {
        x: spawnX + config.playerSize / 2,
        y: spawnY - 20,
        vx: 3,
        vy: -4,
        radius: 8,
      };
    }

    // Reset keyboard keys
    keysRef.current = {};
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current) return;
      keysRef.current[e.code] = true;

      // Space for Jump/Shoot/Attack
      if (e.code === 'Space') {
        e.preventDefault();
        handleActionInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isPlayingRef.current) return;
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [config]);

  // Handle Jump, Shoot, or Combos based on Game Type
  const handleActionInput = () => {
    const player = playerRef.current;
    if (config.type === 'platformer' && player.isGrounded) {
      player.vy = -(config.playerJump || 12);
      player.isGrounded = false;
      sounds.playJump();
    } else if (config.type === 'runner' && player.isGrounded) {
      player.vy = -(config.playerJump || 12);
      player.isGrounded = false;
      sounds.playJump();
    } else if (config.type === 'shooter') {
      // Shoot plasma bullet upward
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y,
        vx: 0,
        vy: -7,
        radius: 4,
        fromPlayer: true,
      });
      sounds.playShoot();
    } else if (config.type === 'fighting' && player.attackCooldown <= 0) {
      player.isAttacking = true;
      player.attackCooldown = 15; // frames
      sounds.playShoot(); // high punch sound effect

      // Hit check
      enemiesRef.current.forEach((enemy) => {
        const attackRange = 40;
        const inXRange = player.facing === 'right'
          ? (enemy.x >= player.x && enemy.x <= player.x + player.width + attackRange)
          : (enemy.x <= player.x && enemy.x >= player.x - attackRange);
        const inYRange = Math.abs(enemy.y - player.y) < 25;

        if (inXRange && inYRange) {
          enemy.hp = (enemy.hp || 1) - 1;
          sounds.playExplosion();
          if (enemy.hp <= 0) {
            updateScore(scoreRef.current + 1);
            // Respawn enemy from sides to keep fighting alive!
            enemy.x = Math.random() > 0.5 ? 820 : -30;
            enemy.hp = 1;
          }
        }
      });
    }
  };

  // Main game loop
  useEffect(() => {
    let animFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellWidth = 800 / 24;
    const cellHeight = 450 / 16;

    const updatePhysics = () => {
      if (!isPlayingRef.current) return;

      const player = playerRef.current;
      const keys = keysRef.current;
      const activeType = config.type;

      // Decrement Attack Cooldown
      if (player.attackCooldown > 0) {
        player.attackCooldown--;
        if (player.attackCooldown <= 0) player.isAttacking = false;
      }

      // Movement logic per game type
      if (activeType === 'platformer' || activeType === 'runner') {
        // Platformer gravity & jump physics
        if (keys['ArrowRight'] || keys['KeyD']) {
          player.vx = config.playerSpeed;
          player.facing = 'right';
        } else if (keys['ArrowLeft'] || keys['KeyA']) {
          player.vx = -config.playerSpeed;
          player.facing = 'left';
        } else {
          player.vx = 0;
        }

        // Apply gravity
        player.vy += config.gravity || 0.6;
        player.x += player.vx;
        player.y += player.vy;

        // Wall & Ground Collisions
        player.isGrounded = false;

        // Solid block checks
        for (let r = 0; r < 16; r++) {
          for (let c = 0; c < 24; c++) {
            if (gridRef.current[r][c] === 1) { // Solid wall
              const blockX = c * cellWidth;
              const blockY = r * cellHeight;

              // Simple AABB Collision response
              if (
                player.x < blockX + cellWidth &&
                player.x + player.width > blockX &&
                player.y < blockY + cellHeight &&
                player.y + player.height > blockY
              ) {
                // Vertical collision
                if (player.vy > 0 && player.y + player.height - player.vy <= blockY) {
                  player.y = blockY - player.height;
                  player.vy = 0;
                  player.isGrounded = true;
                } else if (player.vy < 0 && player.y - player.vy >= blockY + cellHeight) {
                  player.y = blockY + cellHeight;
                  player.vy = 0;
                }
                // Horizontal collision
                else if (player.vx > 0 && player.x + player.width - player.vx <= blockX) {
                  player.x = blockX - player.width;
                } else if (player.vx < 0 && player.x - player.vx >= blockX + cellWidth) {
                  player.x = blockX + cellWidth;
                }
              }
            }
          }
        }

        // Platformer Collect coins & Win Portal check
        const pr = Math.floor((player.y + player.height/2) / cellHeight);
        const pc = Math.floor((player.x + player.width/2) / cellWidth);
        if (pr >= 0 && pr < 16 && pc >= 0 && pc < 24) {
          const val = gridRef.current[pr][pc];
          if (val === 2) { // Coin
            gridRef.current[pr][pc] = 0;
            updateScore(scoreRef.current + 1);
            sounds.playCoin();
          } else if (val === 3) { // Portal
            sounds.playWin();
            setIsPlaying(false);
            if (onWin) onWin();
          }
        }

        // Screen boundary death for fall
        if (player.y > 450) {
          handlePlayerDeath();
        }

      } else if (activeType === 'rpg' || activeType === 'puzzle') {
        // Multi-directional grid/free movement
        player.vx = 0;
        player.vy = 0;
        if (keys['ArrowRight'] || keys['KeyD']) {
          player.vx = config.playerSpeed;
          player.facing = 'right';
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
          player.vx = -config.playerSpeed;
          player.facing = 'left';
        }
        if (keys['ArrowUp'] || keys['KeyW']) player.vy = -config.playerSpeed;
        if (keys['ArrowDown'] || keys['KeyS']) player.vy = config.playerSpeed;

        player.x += player.vx;
        // X wall collision
        resolveGridCollisions(player, cellWidth, cellHeight, 'x');

        player.y += player.vy;
        // Y wall collision
        resolveGridCollisions(player, cellWidth, cellHeight, 'y');

        // RPG items check (Key & Locked Portal)
        const pr = Math.floor((player.y + player.height/2) / cellHeight);
        const pc = Math.floor((player.x + player.width/2) / cellWidth);
        if (pr >= 0 && pr < 16 && pc >= 0 && pc < 24) {
          const val = gridRef.current[pr][pc];
          if (val === 5) { // Key
            gridRef.current[pr][pc] = 0;
            player.hasKey = true;
            sounds.playCoin();
          } else if (val === 2) { // Diamond/Coin
            gridRef.current[pr][pc] = 0;
            updateScore(scoreRef.current + 1);
            sounds.playCoin();
          } else if (val === 3) { // Locked Exit
            if (player.hasKey || activeType === 'puzzle') {
              sounds.playWin();
              setIsPlaying(false);
              if (onWin) onWin();
            }
          }
        }

      } else if (activeType === 'shooter') {
        // Shooter horizontal layout
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= config.playerSpeed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += config.playerSpeed;

        // Clamp inside screen
        player.x = Math.max(0, Math.min(800 - player.width, player.x));

        // Move bullets
        bulletsRef.current.forEach((bullet, index) => {
          bullet.y += bullet.vy;
          // Bullet hits alien
          if (bullet.fromPlayer) {
            enemiesRef.current.forEach((enemy, eIdx) => {
              if (
                bullet.x > enemy.x &&
                bullet.x < enemy.x + enemy.width &&
                bullet.y > enemy.y &&
                bullet.y < enemy.y + enemy.height
              ) {
                // Hit!
                bulletsRef.current.splice(index, 1);
                enemiesRef.current.splice(eIdx, 1);
                updateScore(scoreRef.current + 1);
                sounds.playExplosion();

                // Trigger win if score limit reached
                if (scoreRef.current >= config.winScore) {
                  sounds.playWin();
                  setIsPlaying(false);
                  if (onWin) onWin();
                }
              }
            });
          }
        });

        // Alien simple down/wave movement
        enemiesRef.current.forEach((enemy) => {
          enemy.y += 0.25;
          if (enemy.y > 420) {
            handlePlayerDeath();
          }
        });

      } else if (activeType === 'racing') {
        // Highway scroll
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= config.playerSpeed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += config.playerSpeed;

        // Keep inside track
        player.x = Math.max(cellWidth, Math.min(800 - cellWidth - player.width, player.x));

        // Progress racing track distance
        racingDistance.current += 0.05;
        updateScore(Math.floor(racingDistance.current));

        if (scoreRef.current >= config.winScore) {
          sounds.playWin();
          setIsPlaying(false);
          if (onWin) onWin();
        }

        // Scroll red hazard cars down
        enemiesRef.current.forEach((enemy) => {
          enemy.y += config.enemySpeed || 3;
          if (enemy.y > 450) {
            enemy.y = -50;
            enemy.x = cellWidth + Math.random() * (800 - cellWidth * 3);
          }

          // Crash check
          if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
          ) {
            sounds.playExplosion();
            handlePlayerDeath();
            enemy.y = -50; // respawn
          }
        });

      } else if (activeType === 'arcade') {
        // Retro breakout paddle & ball
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= config.playerSpeed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += config.playerSpeed;

        // Clamp paddle
        player.x = Math.max(0, Math.min(800 - player.width, player.x));

        // Ball movement
        const ball = ballRef.current;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall bounce
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > 800) {
          ball.vx *= -1;
          sounds.playJump();
        }
        if (ball.y - ball.radius < 0) {
          ball.vy *= -1;
          sounds.playJump();
        }

        // Paddle bounce
        if (
          ball.y + ball.radius >= player.y &&
          ball.y - ball.radius <= player.y + player.height &&
          ball.x >= player.x &&
          ball.x <= player.x + player.width
        ) {
          ball.vy = -Math.abs(ball.vy);
          // Angle ball based on hit location
          const relativeHit = (ball.x - (player.x + player.width / 2)) / (player.width / 2);
          ball.vx = relativeHit * 5;
          sounds.playJump();
        }

        // Bottom fail death
        if (ball.y > 450) {
          handlePlayerDeath();
          ball.x = player.x + player.width / 2;
          ball.y = player.y - 20;
          ball.vy = -3;
        }

        // Brick collision
        for (let r = 0; r < 16; r++) {
          for (let c = 0; c < 24; c++) {
            if (gridRef.current[r][c] === 1) { // Brick
              const bx = c * cellWidth;
              const by = r * cellHeight;

              if (
                ball.x + ball.radius > bx &&
                ball.x - ball.radius < bx + cellWidth &&
                ball.y + ball.radius > by &&
                ball.y - ball.radius < by + cellHeight
              ) {
                // Break!
                gridRef.current[r][c] = 0;
                ball.vy *= -1;
                updateScore(scoreRef.current + 1);
                sounds.playCoin();

                if (scoreRef.current >= config.winScore) {
                  sounds.playWin();
                  setIsPlaying(false);
                  if (onWin) onWin();
                }
                break;
              }
            }
          }
        }
      } else if (activeType === 'strategy') {
        // Strategy tower auto shoots at incoming waves
        strategySpawnTimer.current++;
        if (strategySpawnTimer.current % 120 === 0) {
          // Spawn enemy marcher
          marchersRef.current.push({
            x: 0 * cellWidth + cellWidth / 2,
            y: 1 * cellHeight + cellHeight / 2,
            targetIdx: 0,
            hp: 3,
          });
        }

        // Path coordinates for marchers based on strategy template layout
        const pathPoints = [
          { x: 22, y: 1 },
          { x: 22, y: 14 },
          { x: 23, y: 14 },
        ];

        // Move marchers along path
        marchersRef.current.forEach((marcher, index) => {
          const target = pathPoints[marcher.targetIdx] || pathPoints[pathPoints.length - 1];
          const tx = target.x * cellWidth + cellWidth / 2;
          const ty = target.y * cellHeight + cellHeight / 2;

          const dx = tx - marcher.x;
          const dy = ty - marcher.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 5) {
            if (marcher.targetIdx < pathPoints.length - 1) {
              marcher.targetIdx++;
            } else {
              // Reached castle! Lose life
              marchersRef.current.splice(index, 1);
              sounds.playExplosion();
              handlePlayerDeath();
            }
          } else {
            marcher.x += (dx / dist) * (config.enemySpeed || 1);
            marcher.y += (dy / dist) * (config.enemySpeed || 1);
          }
        });

        // Towers shoot at nearest marchers
        towersRef.current.forEach((tower) => {
          if (tower.cooldown > 0) {
            tower.cooldown--;
          } else {
            // Find closest marcher
            let closest: typeof marchersRef.current[0] | null = null;
            let minDist = 150; // Tower range

            marchersRef.current.forEach((marcher) => {
              const dx = marcher.x - tower.x;
              const dy = marcher.y - tower.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist) {
                minDist = dist;
                closest = marcher;
              }
            });

            if (closest) {
              // Shoot bullet
              bulletsRef.current.push({
                x: tower.x,
                y: tower.y,
                vx: ((closest as any).x - tower.x) / 15,
                vy: ((closest as any).y - tower.y) / 15,
                radius: 4,
                fromPlayer: true,
              });
              tower.cooldown = 45; // Shoot cooldown
              sounds.playShoot();
            }
          }
        });

        // Move bullets and check hits on marchers
        bulletsRef.current.forEach((bullet, bIdx) => {
          bullet.x += bullet.vx;
          bullet.y += bullet.vy;

          marchersRef.current.forEach((marcher, mIdx) => {
            const dx = bullet.x - marcher.x;
            const dy = bullet.y - marcher.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) {
              // Hit!
              bulletsRef.current.splice(bIdx, 1);
              marcher.hp--;
              sounds.playExplosion();

              if (marcher.hp <= 0) {
                marchersRef.current.splice(mIdx, 1);
                updateScore(scoreRef.current + 1);

                if (scoreRef.current >= config.winScore) {
                  sounds.playWin();
                  setIsPlaying(false);
                  if (onWin) onWin();
                }
              }
            }
          });
        });
      }

      // Classic patrol enemies update
      enemiesRef.current.forEach((enemy) => {
        enemy.x += enemy.vx;

        // Simple horizontal patrol limit
        if (enemy.originX && enemy.patX) {
          if (enemy.x > enemy.originX + enemy.patX || enemy.x < enemy.originX - enemy.patX) {
            enemy.vx *= -1;
          }
        }

        // Enemy vs Player hit box check
        if (
          player.x < enemy.x + enemy.width &&
          player.x + player.width > enemy.x &&
          player.y < enemy.y + enemy.height &&
          player.y + player.height > enemy.y
        ) {
          if (activeType === 'platformer' && player.vy > 0 && player.y + player.height - player.vy <= enemy.y + 10) {
            // Player jump stomped enemy!
            sounds.playExplosion();
            enemiesRef.current = enemiesRef.current.filter((e) => e !== enemy);
            player.vy = -8; // Bounce up
            updateScore(scoreRef.current + 1);
          } else {
            // Player took hit!
            sounds.playExplosion();
            handlePlayerDeath();
          }
        }
      });
    };

    // Simple grid collision resolver for RPG/Puzzle pushable crates
    const resolveGridCollisions = (
      ent: typeof playerRef.current,
      cw: number,
      ch: number,
      axis: 'x' | 'y'
    ) => {
      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 24; c++) {
          const val = gridRef.current[r][c];
          if (val === 1 || val === 6) { // Solid wall or Crate
            const blockX = c * cw;
            const blockY = r * ch;

            if (
              ent.x < blockX + cw &&
              ent.x + ent.width > blockX &&
              ent.y < blockY + ch &&
              ent.y + ent.height > blockY
            ) {
              if (val === 6 && config.type === 'puzzle') {
                // Puzzle pushable box mechanics!
                let pushX = 0;
                let pushY = 0;
                if (axis === 'x') pushX = ent.vx > 0 ? cw : -cw;
                if (axis === 'y') pushY = ent.vy > 0 ? ch : -ch;

                const targetC = c + (pushX ? Math.sign(pushX) : 0);
                const targetR = r + (pushY ? Math.sign(pushY) : 0);

                if (
                  targetC >= 0 &&
                  targetC < 24 &&
                  targetR >= 0 &&
                  targetR < 16 &&
                  gridRef.current[targetR][targetC] === 0
                ) {
                  // Push crate!
                  gridRef.current[r][c] = 0;
                  gridRef.current[targetR][targetC] = 6;
                  sounds.playJump();

                  // Check if on green goal spot
                  if (config.grid[targetR][targetC] === 7) {
                    sounds.playCoin();
                    updateScore(scoreRef.current + 1);
                    if (scoreRef.current >= config.winScore) {
                      sounds.playWin();
                      setIsPlaying(false);
                      if (onWin) onWin();
                    }
                  }
                }
              }

              // Apply standard block stop
              if (axis === 'x') {
                if (ent.vx > 0) ent.x = blockX - ent.width;
                else if (ent.vx < 0) ent.x = blockX + cw;
              } else {
                if (ent.vy > 0) ent.y = blockY - ent.height;
                else if (ent.vy < 0) ent.y = blockY + ch;
              }
            }
          }
        }
      }
    };

    // Lose life and trigger GameOver
    const handlePlayerDeath = () => {
      const nextLives = livesRef.current - 1;
      updateLives(nextLives);
      if (nextLives <= 0) {
        sounds.playLose();
        setIsPlaying(false);
        if (onGameOver) onGameOver();
      } else {
        // Respawn player
        playerRef.current.x = 50;
        playerRef.current.y = 50;
        playerRef.current.vx = 0;
        playerRef.current.vy = 0;
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, 800, 450);

      // Draw level background grid blocks
      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 24; c++) {
          const val = gridRef.current[r][c];
          const bx = c * cellWidth;
          const by = r * cellHeight;

          if (val === 1) { // Wall/Platform
            ctx.fillStyle = config.type === 'racing' ? '#334155' : '#1e293b';
            ctx.fillRect(bx, by, cellWidth, cellHeight);
            ctx.strokeStyle = '#475569';
            ctx.strokeRect(bx, by, cellWidth, cellHeight);
          } else if (val === 2) { // Gold Coin
            ctx.beginPath();
            ctx.arc(bx + cellWidth / 2, by + cellHeight / 2, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          } else if (val === 3) { // Portal
            ctx.fillStyle = '#a855f7';
            ctx.fillRect(bx + 4, by + 4, cellWidth - 8, cellHeight - 8);
            ctx.strokeStyle = '#c084fc';
            ctx.strokeRect(bx + 2, by + 2, cellWidth - 4, cellHeight - 4);
          } else if (val === 5) { // Key
            ctx.fillStyle = '#eab308';
            ctx.fillRect(bx + cellWidth / 2 - 4, by + cellHeight / 2 - 8, 8, 16);
          } else if (val === 6) { // Crate Box
            ctx.fillStyle = '#78716c';
            ctx.fillRect(bx + 2, by + 2, cellWidth - 4, cellHeight - 4);
            ctx.strokeStyle = '#a8a29e';
            ctx.strokeRect(bx + 2, by + 2, cellWidth - 4, cellHeight - 4);
          } else if (val === 7) { // Crate Target Goal
            ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
            ctx.fillRect(bx + 4, by + 4, cellWidth - 8, cellHeight - 8);
            ctx.strokeStyle = '#22c55e';
            ctx.strokeRect(bx + 4, by + 4, cellWidth - 8, cellHeight - 8);
          } else if (val === 8) { // Strategy Tower defense
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(bx + cellWidth / 2, by + cellHeight / 2, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw Castle Target Base in strategy mode
      if (config.type === 'strategy') {
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(23 * cellWidth, 14 * cellHeight, cellWidth, cellHeight);
      }

      // Draw Bullets
      bulletsRef.current.forEach((bullet) => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      });

      // Draw Enemies
      enemiesRef.current.forEach((enemy) => {
        ctx.fillStyle = config.enemyColor || '#ef4444';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
      });

      // Draw Strategy Marchers
      if (config.type === 'strategy') {
        marchersRef.current.forEach((marcher) => {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(marcher.x, marcher.y, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Player
      const player = playerRef.current;
      ctx.fillStyle = config.playerColor;
      ctx.fillRect(player.x, player.y, player.width, player.height);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(player.x, player.y, player.width, player.height);

      // Draw attack visual ring for Fighting game
      if (player.isAttacking) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        const ax = player.facing === 'right' ? player.x + player.width : player.x - 30;
        ctx.fillRect(ax, player.y, 30, player.height);
      }

      // Draw Arcade Ball
      if (config.type === 'arcade') {
        const ball = ballRef.current;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#eab308';
        ctx.fill();
      }
    };

    const loop = () => {
      updatePhysics();
      render();
      animFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [config, isPlaying]);

  // Click handler to build Strategy towers in Strategy mode or edit grid
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (config.type !== 'strategy' || !isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellWidth = 800 / 24;
    const cellHeight = 450 / 16;

    const c = Math.floor(x / cellWidth);
    const r = Math.floor(y / cellHeight);

    if (r >= 0 && r < 16 && c >= 0 && c < 24) {
      if (gridRef.current[r][c] === 0) {
        gridRef.current[r][c] = 8; // Place defense tower
        towersRef.current.push({
          x: c * cellWidth + cellWidth / 2,
          y: r * cellHeight + cellHeight / 2,
          cooldown: 0,
        });
        sounds.playJump();
        // Force state update to re-render React components
        setActiveGrid([...gridRef.current]);
      }
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden glow-primary max-w-full">
      {/* Game controls header */}
      <div className="flex justify-between items-center w-full px-6 py-4 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-6 py-2.5 font-bold rounded-md cursor-pointer transition-all ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
            }`}
          >
            {isPlaying ? '⏸️ إيقاف اللعب' : '🎮 تشغيل اللعبة'}
          </button>

          <button
            onClick={resetGame}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-md cursor-pointer"
          >
            🔄 إعادة تعيين
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="text-slate-400">النقاط:</span>{' '}
            <span className="text-xl font-black text-amber-400">{scoreRef.current}</span> / {config.winScore}
          </div>
          <div className="text-sm">
            <span className="text-slate-400">الأرواح:</span>{' '}
            <span className="text-xl font-black text-rose-500">
              {Array(Math.max(0, livesRef.current)).fill('❤️').join('') || '💀'}
            </span>
          </div>
        </div>
      </div>

      {/* Screen Canvas area */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          onClick={handleCanvasClick}
          className="block w-full max-w-[800px] aspect-[16/9] bg-slate-950/90 cursor-crosshair"
        />
        {!isPlaying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm transition-all">
            <p className="text-3xl font-black tracking-wide text-indigo-400 mb-2">🎮 اضغط تشغيل اللعبة للعب فوراً</p>
            <p className="text-slate-400 text-sm">استخدم أزرار الأسهم أو الحروف (W, A, S, D) للحركة ومفتاح المسافة للتفاعل</p>
          </div>
        )}
      </div>

      {/* On-screen touch controls for Mobile phones and tablets */}
      <div className="flex justify-between items-center w-full px-6 py-4 bg-slate-800/50 border-t border-slate-700 gap-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onMouseDown={() => { keysRef.current['ArrowLeft'] = true; }}
            onMouseUp={() => { keysRef.current['ArrowLeft'] = false; }}
            onTouchStart={() => { keysRef.current['ArrowLeft'] = true; }}
            onTouchEnd={() => { keysRef.current['ArrowLeft'] = false; }}
            className="w-14 h-14 bg-slate-700 active:bg-slate-500 rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer"
          >
            ◀️
          </button>
          <div className="flex flex-col gap-2">
            <button
              onMouseDown={() => { keysRef.current['ArrowUp'] = true; }}
              onMouseUp={() => { keysRef.current['ArrowUp'] = false; }}
              onTouchStart={() => { keysRef.current['ArrowUp'] = true; }}
              onTouchEnd={() => { keysRef.current['ArrowUp'] = false; }}
              className="w-14 h-14 bg-slate-700 active:bg-slate-500 rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer"
            >
              ▲
            </button>
            <button
              onMouseDown={() => { keysRef.current['ArrowDown'] = true; }}
              onMouseUp={() => { keysRef.current['ArrowDown'] = false; }}
              onTouchStart={() => { keysRef.current['ArrowDown'] = true; }}
              onTouchEnd={() => { keysRef.current['ArrowDown'] = false; }}
              className="w-14 h-14 bg-slate-700 active:bg-slate-500 rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer"
            >
              ▼
            </button>
          </div>
          <button
            onMouseDown={() => { keysRef.current['ArrowRight'] = true; }}
            onMouseUp={() => { keysRef.current['ArrowRight'] = false; }}
            onTouchStart={() => { keysRef.current['ArrowRight'] = true; }}
            onTouchEnd={() => { keysRef.current['ArrowRight'] = false; }}
            className="w-14 h-14 bg-slate-700 active:bg-slate-500 rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer"
          >
            ▶️
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleActionInput}
            className="px-8 h-14 bg-indigo-600 active:bg-indigo-500 rounded-lg text-lg font-bold shadow-md cursor-pointer text-white"
          >
            🔥 تفاعل / قفز (Space)
          </button>
        </div>
      </div>
    </div>
  );
};
