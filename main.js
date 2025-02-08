"use strict";

// PreloadScene: Loads all assets and then switches to the menu.
class PreloadScene extends Phaser.Scene {
    constructor() {
        super("PreloadScene");
    }
    preload() {
        // Ensure crossOrigin is set.
        this.load.crossOrigin = "anonymous";

        this.load.image("background", "assets/background.svg");
        this.load.image("ground", "assets/ground.svg");
        // The tank spritesheet is 144x32 (3 frames of 48x32 each).
        this.load.spritesheet("tank", "assets/tank.svg", {
            frameWidth: 48,
            frameHeight: 32
        });
        this.load.image("pipe", "assets/pipe.svg");
    }
    create() {
        this.scene.start("MenuScene");
    }
}

// MenuScene: Displays title and instructions.
class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }
    create() {
        this.add.image(200, 300, "background");

        this.add.text(200, 150, "Kopi - Soviet Flappy Tank", {
            font: "28px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(200, 300, "Click or Press SPACE to Start", {
            font: "20px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        // Resume AudioContext on first interaction.
        const resumeAudio = () => {
            if (this.sound && this.sound.context && this.sound.context.state === "suspended") {
                this.sound.context.resume();
            }
            this.startGame();
        };

        this.input.once("pointerdown", resumeAudio, this);
        this.input.keyboard.once("keydown-SPACE", resumeAudio, this);
    }
    startGame() {
        this.scene.start("GameScene");
    }
}

// GameScene: Main gameplay.
class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this.pipeTimer = null;
        this.score = 0;
        this.scoreText = null;
    }
    create() {
        this.score = 0;

        this.add.image(200, 300, "background");

        this.pipes = this.physics.add.group();

        this.ground = this.add.tileSprite(200, 584, 400, 32, "ground");
        this.physics.add.existing(this.ground, true);

        this.tank = this.physics.add.sprite(100, 300, "tank");
        this.tank.setOrigin(0.5);
        this.tank.body.gravity.y = 800;
        this.tank.setCollideWorldBounds(true);

        // Create the flying animation using the 3-frame spritesheet.
        this.anims.create({
            key: "fly",
            frames: this.anims.generateFrameNumbers("tank", { start: 0, end: 2 }),
            frameRate: 10,
            repeat: -1
        });
        this.tank.play("fly");

        this.input.on("pointerdown", this.flap, this);
        this.input.keyboard.on("keydown-SPACE", this.flap, this);

        this.physics.add.collider(this.tank, this.ground, this.hitObstacle, null, this);
        this.physics.add.overlap(this.tank, this.pipes, this.hitObstacle, null, this);

        this.scoreText = this.add.text(20, 20, "Score: 0", {
            font: "24px Arial",
            fill: "#ffffff"
        });

        this.pipeTimer = this.time.addEvent({
            delay: 1500,
            callback: this.addPipeRow,
            callbackScope: this,
            loop: true
        });
    }

    flap() {
        this.tank.setVelocityY(-300);
    }

    addPipeRow() {
        const gapCenter = Phaser.Math.Between(100, 400);
        const gapSize = 120;
        const topPipeY = gapCenter - gapSize / 2;
        const bottomPipeY = gapCenter + gapSize / 2;

        let topPipe = this.pipes.create(420, topPipeY, "pipe");
        topPipe.setOrigin(0, 1);
        topPipe.body.velocity.x = -200;
        topPipe.flipY = true;

        let bottomPipe = this.pipes.create(420, bottomPipeY, "pipe");
        bottomPipe.setOrigin(0, 0);
        bottomPipe.body.velocity.x = -200;

        topPipe.scored = false;
        bottomPipe.scored = false;
    }

    update() {
        this.ground.tilePositionX += 2;

        this.pipes.getChildren().forEach((pipe) => {
            if (pipe.x < -pipe.width) {
                pipe.destroy();
            } else if (!pipe.scored && pipe.x + pipe.width < this.tank.x) {
                if (pipe.flipY) {
                    pipe.scored = true;
                    this.score++;
                    this.scoreText.setText("Score: " + this.score);
                }
            }
        }, this);

        if (this.tank.y < 0) {
            this.hitObstacle();
        }
    }

    hitObstacle() {
        this.pipeTimer.remove();
        this.pipes.setVelocityX(0);
        this.tank.body.gravity.y = 0;
        this.tank.setVelocity(0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start("GameOverScene", { score: this.score });
        });
    }
}

// GameOverScene: Displays final score and restart instructions.
class GameOverScene extends Phaser.Scene {
    constructor() {
        super("GameOverScene");
    }
    init(data) {
        this.finalScore = data.score;
    }
    create() {
        this.add.image(200, 300, "background");

        this.add.text(200, 200, "Game Over", {
            font: "48px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(200, 260, "Score: " + this.finalScore, {
            font: "32px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(200, 320, "Click or Press SPACE to Restart", {
            font: "20px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        this.input.once("pointerdown", () => {
            this.scene.start("GameScene");
        });
        this.input.keyboard.once("keydown-SPACE", () => {
            this.scene.start("GameScene");
        });
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
    scene: [PreloadScene, MenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);
