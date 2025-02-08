"use strict";

// Game physics and timing constants
const GRAVITY = 800;
const FLAP_VELOCITY = -300;
const PIPE_SPEED = -200;
const PIPE_INTERVAL = 1500;
const GAP_SIZE = 120;

// PreloadScene: Loads all assets before starting the game.
class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }
  preload() {
    // Enable cross-origin loading (assets must be served via HTTP)
    this.load.crossOrigin = "anonymous";
    this.load.image("background", "assets/background.svg");
    this.load.image("ground", "assets/ground.svg");
    // Updated: Tank spritesheet is now 3 frames of 90×80 each.
    this.load.spritesheet("tank", "assets/tank.svg", { frameWidth: 90, frameHeight: 80 });
    this.load.image("pipe", "assets/pipe.svg");
  }
  create() {
    this.scene.start("MenuScene");
  }
}

// MenuScene: A fully accessible, multi-device welcome screen.
class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }
  create() {
    // Display the background image covering the canvas.
    this.add.image(200, 300, "background");

    // Semi-transparent overlay for text clarity.
    this.add.rectangle(200, 300, 400, 600, 0x000000, 0.4);

    // Title text
    this.add.text(200, 150, "Flappy Tank", {
      font: "32px Arial",
      fill: "#ffffff",
      stroke: "#000",
      strokeThickness: 4
    }).setOrigin(0.5);

    // Instructions text – supports multiple devices (tap or key press)
    this.add.text(200, 250, "Tap or press SPACE to start\nUse SPACE/tap to flap\nPress ESC to pause", {
      font: "20px Arial",
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);

    // Resume AudioContext (if needed) and start the game on first user interaction.
    const startGame = () => {
      if (this.sound && this.sound.context && this.sound.context.state === "suspended") {
        this.sound.context.resume();
      }
      this.scene.start("GameScene");
    };

    this.input.once("pointerdown", startGame, this);
    this.input.keyboard.once("keydown-SPACE", startGame, this);
  }
}

// GameScene: Main gameplay with refined physics and improved mechanics.
class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.pipeTimer = null;
    this.score = 0;
    this.scoreText = null;
  }
  create() {
    this.score = 0;
    // Add background.
    this.add.image(200, 300, "background");

    // Create a group for pipes.
    this.pipes = this.physics.add.group();

    // Create scrolling ground.
    this.ground = this.add.tileSprite(200, 584, 400, 32, "ground");
    this.physics.add.existing(this.ground, true);

    // Create the tank (player sprite)
    this.tank = this.physics.add.sprite(100, 300, "tank");
    this.tank.setOrigin(0.5);
    this.tank.body.gravity.y = GRAVITY;
    this.tank.setCollideWorldBounds(true);
    // Adjust the physics body to better match the visible tank.
    // For a 90×80 sprite, a collision box of 60×40 with an offset of (15,20) works well.
    this.tank.body.setSize(60, 40);
    this.tank.body.setOffset(15, 20);

    // Tank animation from the 3-frame spritesheet.
    this.anims.create({
      key: "fly",
      frames: this.anims.generateFrameNumbers("tank", { start: 0, end: 2 }),
      frameRate: 10,
      repeat: -1
    });
    this.tank.play("fly");

    // Input: pointer for touch/mouse and SPACE for keyboard.
    this.input.on("pointerdown", this.flap, this);
    this.input.keyboard.on("keydown-SPACE", this.flap, this);

    // Pause control: press ESC to pause.
    this.input.keyboard.on("keydown-ESC", this.togglePause, this);

    // Collision detection: tank vs. ground and pipes.
    this.physics.add.collider(this.tank, this.ground, this.hitObstacle, null, this);
    // Use collider (instead of overlap) for reliable collision detection with pipes.
    this.physics.add.collider(this.tank, this.pipes, this.hitObstacle, null, this);

    // Score display.
    this.scoreText = this.add.text(20, 20, "Score: 0", {
      font: "24px Arial",
      fill: "#ffffff",
      stroke: "#000",
      strokeThickness: 3
    });

    // Generate pipes at set intervals.
    this.pipeTimer = this.time.addEvent({
      delay: PIPE_INTERVAL,
      callback: this.addPipeRow,
      callbackScope: this,
      loop: true
    });
  }
  
  flap() {
    this.tank.setVelocityY(FLAP_VELOCITY);
  }
  
  addPipeRow() {
    const gapCenter = Phaser.Math.Between(100, 400);
    const topPipeY = gapCenter - GAP_SIZE / 2;
    const bottomPipeY = gapCenter + GAP_SIZE / 2;

    // Top pipe (flipped vertically)
    let topPipe = this.pipes.create(420, topPipeY, "pipe");
    topPipe.setOrigin(0, 1);
    topPipe.body.velocity.x = PIPE_SPEED;
    topPipe.flipY = true;

    // Bottom pipe
    let bottomPipe = this.pipes.create(420, bottomPipeY, "pipe");
    bottomPipe.setOrigin(0, 0);
    bottomPipe.body.velocity.x = PIPE_SPEED;

    topPipe.scored = false;
    bottomPipe.scored = false;
  }
  
  update() {
    // Scroll the ground.
    this.ground.tilePositionX += 2;

    // Remove off-screen pipes and update the score.
    this.pipes.getChildren().forEach((pipe) => {
      if (pipe.x < -pipe.width) {
        pipe.destroy();
      } else if (!pipe.scored && pipe.x + pipe.width < this.tank.x) {
        // Increase score only once per pipe pair (using the top pipe as the marker)
        if (pipe.flipY) {
          pipe.scored = true;
          this.score++;
          this.scoreText.setText("Score: " + this.score);
        }
      }
    });

    // If the tank flies off the top, treat it as a collision.
    if (this.tank.y < 0) {
      this.hitObstacle();
    }
  }
  
  hitObstacle() {
    // Stop pipe generation and freeze movement.
    this.pipeTimer.remove();
    this.pipes.setVelocityX(0);
    this.tank.body.gravity.y = 0;
    this.tank.setVelocity(0, 0);
    // Fade out before moving to Game Over.
    this.cameras.main.fade(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.start("GameOverScene", { score: this.score });
    });
  }
  
  togglePause() {
    // Toggle pause: launch the PauseScene and pause GameScene.
    if (!this.scene.isPaused("GameScene")) {
      this.scene.launch("PauseScene");
      this.scene.pause();
    }
  }
}

// PauseScene: An overlay that allows users to resume the game.
class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }
  create() {
    // Semi-transparent overlay.
    this.add.rectangle(200, 300, 400, 600, 0x000000, 0.5);
    this.add.text(200, 300, "Paused\nPress ESC or tap to resume", {
      font: "28px Arial",
      fill: "#ffffff",
      align: "center",
      stroke: "#000",
      strokeThickness: 4
    }).setOrigin(0.5);

    // Resume the game on tap or ESC.
    const resume = () => {
      this.scene.resume("GameScene");
      this.scene.stop();
    };

    this.input.once("pointerdown", resume, this);
    this.input.keyboard.once("keydown-ESC", resume, this);
  }
}

// GameOverScene: Displays the final score and accessible instructions to restart.
class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }
  init(data) {
    this.finalScore = data.score;
  }
  create() {
    this.add.image(200, 300, "background");
    // Semi-transparent overlay for clarity.
    this.add.rectangle(200, 300, 400, 600, 0x000000, 0.4);

    // "Game Over" text.
    this.add.text(200, 180, "Game Over", {
      font: "48px Arial",
      fill: "#ffffff",
      stroke: "#000",
      strokeThickness: 4
    }).setOrigin(0.5);

    // Final score display.
    this.add.text(200, 250, "Score: " + this.finalScore, {
      font: "32px Arial",
      fill: "#ffffff",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5);

    // Restart instructions.
    this.add.text(200, 350, "Tap or press SPACE to Restart", {
      font: "24px Arial",
      fill: "#ffffff",
      stroke: "#000",
      strokeThickness: 2,
      align: "center"
    }).setOrigin(0.5);

    const restartGame = () => {
      this.scene.start("GameScene");
    };

    this.input.once("pointerdown", restartGame, this);
    this.input.keyboard.once("keydown-SPACE", restartGame, this);
  }
}

// Phaser game configuration.
const config = {
  type: Phaser.AUTO,
  width: 400,
  height: 600,
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [PreloadScene, MenuScene, GameScene, PauseScene, GameOverScene]
};

const game = new Phaser.Game(config);
