/// <reference path="jslib-modular/physics2d.d.ts" />
/// <reference path="jslib-modular/tzdraw2d.d.ts" />
/// <reference path="jslib-modular/tzdraw2d.d.ts" />

/// <reference path="rigidSprite.ts"/>
/// <reference path="interfaces.ts"/>
/// <reference path="animatedTexture.ts"/>
/// <reference path="masks.ts"/>

// a player's sprite is an instance of an animated sprite, which has a
// direction (facing), possibly multiple animated sprite sheets,
// and each sheet has a corresponding cycle time.

class Player {
    SPEED = 0.1;
    JUMP_SPEED = 0.5;
    DIST_EPSILON = 0.05;
    CLIMB_SPEED = 2;
    THRESHOLD_STANDING_SPEED = 0.001;

    canClimb:boolean = false;
    isClimbing:boolean = false;
    climbableObject:Climbable = null;
    canBuild:boolean = false;
    rigidSprite:RigidSprite = null;

    leftBlockingShape:Physics2DShape = null;
    rightBlockingShape:Physics2DShape = null;

    onGround:boolean = false; // true if the player is standing on the ground, or was last time we checked
    groundShape: Physics2DShape = null; // the last surface the player was standing on

    facing:Direction = Direction.RIGHT;

    standTexture:AnimatedTexture = new AnimatedTexture("assets/player/stand.png", [256, 256], 3, true);
    walkTexture:AnimatedTexture = new AnimatedTexture("assets/player/walk.png", [256, 256], 8, true);
    jumpTexture:AnimatedTexture = new AnimatedTexture("assets/player/jump.png", [256, 256], 7, false);
    currentTexture:AnimatedTexture = null;

    frameDimensions:number[] = [256, 256];
    animationFrameDurationMS:number = 100;
    animationTimeout:number = null;

    lastClimbPosition:number[] = null;

    playerDimensions:number[] = [128, 128];

    keys:any;
    collisionUtil:Physics2DCollisionUtils;
    mathDevice:MathDevice;
    game:GameObject;

    loadTextures(graphicsDevice:GraphicsDevice)
    {
        // import an image to use as the player display and when loading is done set it as the player's texture
        this.standTexture.loadTexture(graphicsDevice);
        this.walkTexture.loadTexture(graphicsDevice);
        this.jumpTexture.loadTexture(graphicsDevice);
        this.currentTexture = this.standTexture;
    }

    constructor (game:GameObject, position:number[])
    {
        this.game = game;
        this.collisionUtil = game.collisionHelp.collisionUtils;
        this.mathDevice = game.mathDevice;
        // build the player sprite
        var playerParams:any = {
            x: position[0],
            y: position[1],
            width: this.playerDimensions[0],
            height: this.playerDimensions[1],
            color: [1.0, 1.0, 1.0, 1.0]
        };
        var playerSprite:Draw2DSprite = Draw2DSprite.create(playerParams);
        var playerVertices:number[][] = game.physicsDevice.createRectangleVertices(-playerParams.width/4, -playerParams.height/2,
                                                                                   playerParams.width/4, playerParams.height/2);

        var playerShape:Physics2DShape = game.physicsDevice.createPolygonShape({
            vertices: playerVertices,
            group: ShapeGroups.PLAYER,
            mask: ObjectMasks.SOLID
        });
        var playerBody:Physics2DRigidBody = game.physicsDevice.createRigidBody({
            type: 'dynamic',
            shapes: [playerShape],
            mass: 4,
            linearDrag: 0.001
        });
        var playerRigidSprite:RigidSprite = new RigidSprite({
            sprite:playerSprite,
            initialPos:[0, 0],
            body:playerBody
        });
        // next we build a player, including the rigid body, sprite, and managing object
        this.loadTextures(game.graphicsDevice);
        this.animationTimeout = window.setInterval(
            ()=> {
                if (this.currentTexture)
                {
                    this.currentTexture.updateCurrentFrame();
                }
            }, this.animationFrameDurationMS);

        this.rigidSprite = playerRigidSprite;
        this.rigidSprite.body.setPosition(position); // should be added to rigidSprite...

        game.physicsWorld.addRigidBody(playerBody);

        // mark the shape as a player
        this.rigidSprite.body.shapes[0].userData = {type: "player", playerObject:this};

        // set up jumping for the player
        this.rigidSprite.body.shapes[0].addEventListener('begin', this.checkCollision, undefined, false);
    }

    // sets the texture used to display the character. If no texture is null, displays a white box
    setTexture(texture) {
        if (this.rigidSprite.sprite != null)
        {
            this.rigidSprite.sprite.setTexture(texture);
        }
    }

    getTextureFrameCount():number {
        if (this.rigidSprite.sprite != null && this.rigidSprite.sprite.getTexture() != null) {
            return Math.floor(this.rigidSprite.sprite.getTexture().width / this.frameDimensions[0]);
        }
        return 1;
    }

    // checks all collisions
    // TODO: combine this and the next function in some nice way
    checkCollision = (arbiter, otherShape) =>
    {
        // whenever we hit another shape, check to see if it counts as ground
        // TODO: Wrap this normal test into the stillOnGround function
        var normal:number[] = arbiter.getNormal();
        if (normal[1] > 0 && normal[1] > normal[0])
        {
            this.onGround = true;
            console.log("Setting onGround to true");
            this.groundShape = otherShape;
        }

        // also need to check if this stopped us from moving left or right in the air
        if (!this.onGround && !this.isClimbing && normal[0] > 0)
        {
            this.rightBlockingShape = otherShape;
        }
        else if (!this.onGround && !this.isClimbing && normal[0] > 0)
        {
            this.leftBlockingShape = otherShape;
        }
    }

    // only checks collisions with interactables
    collisionCallback(otherObject):void
    {
        // check for climbable and if climbable, set canClimb and save the object
        if (otherObject.hasOwnProperty("isClimbable") && otherObject.isClimbable) {
            this.climbableObject = <Climbable>otherObject;
            this.canClimb = this.climbableObject.isClimbableAtObjectPosition(this.collisionUtil, this.rigidSprite.body.shapes[0]);
        }
        // check for buildable and set canBuild
        if (otherObject.hasOwnProperty("isBuildable") && otherObject.isBuildable) {
            this.canBuild = true;
        }
    }

    // just calls into sprite
    setTextureRectangle(params)
    {
        if (this.rigidSprite.sprite != null)
        {
            this.rigidSprite.sprite.setTextureRectangle(params);
        }
    }

    getPosition(): number[] {
        return this.rigidSprite.body.getPosition();
    }

    setPosition(pos:number[]) {
        this.rigidSprite.body.setPosition(pos);
    }

    stopWalking()
    {
        var vel:number[] = this.rigidSprite.body.getVelocity();
        this.rigidSprite.body.setVelocity([0, vel[1]]);
    }

    walkLeft()
    {
        // we should only be allowed to walk if we are on the ground.
        var vel:number[] = this.rigidSprite.body.getVelocity();
        this.rigidSprite.body.setVelocity([-1*this.SPEED, vel[1]]);
        this.facing = Direction.LEFT;
        this.currentTexture = this.walkTexture;
    }

    walkRight()
    {
        var vel:number[] = this.rigidSprite.body.getVelocity();
        this.rigidSprite.body.setVelocity([this.SPEED, vel[1]]);
        this.facing = Direction.RIGHT;
        this.currentTexture = this.walkTexture;
    }

    goDown()
    {
        // if we can climb then start climbing. Otherwise, do nothing
        if (this.canClimb)
        {
            this.isClimbing = true;
            this.climb();
        }
    }

    goUp()
    {
        // if we can climb then start climbing. Otherwise, do nothing
        if (this.canClimb) {
            this.isClimbing = true;
            this.climb();
        }
    }

    jumpUp()
    {
        this.groundShape = null;
        this.onGround = false;
        this.isClimbing = false;
        var vel:number[] = this.rigidSprite.body.getVelocity();
        this.rigidSprite.body.setVelocity([vel[0], -1*this.JUMP_SPEED]);
    }

    stillOnGround():boolean
    {
        // the player can leave the ground without us noticing in the collision detection,
        // so we need to be able to double check that they are still on the ground.
        // That happens here
        var witA:number[] = [];
        var witB:number[] = [];
        var axis:number[] = [];
        if (this.groundShape != null && this.onGround) {
            return this.game.collisionHelp.collisionUtils.intersects(this.rigidSprite.body.shapes[0], this.groundShape);
        }
        return false;
    }

    canMoveLeft():boolean
    {
        // one can move left if they are on the ground or if they are in the air and not blocked from moving
        var canMove:boolean = this.onGround || (this.leftBlockingShape == null);
        if (this.leftBlockingShape && this.leftBlockingShape.body) {
            canMove = canMove || !this.game.collisionHelp.collisionUtils.intersects(this.rigidSprite.body.shapes[0], this.leftBlockingShape);
        }
        return canMove;
    }

    canMoveRight():boolean
    {
        // one can move left if they are on the ground or if they are in the air and not blocked from moving
        var canMove:boolean = this.onGround || (this.rightBlockingShape == null);
        if (this.rightBlockingShape && this.rightBlockingShape.body) {
            canMove = canMove || !this.game.collisionHelp.collisionUtils.intersects(this.rigidSprite.body.shapes[0], this.rightBlockingShape);
        }
        return canMove;
    }

    climb()
    {
        // make the player kinematic so they can't fall
        //this.rigidSprite.body.setAsKinematic();
        // calculate the movement direction
        var dir:number[] = [0, 0];
        if (this.game.keyboard.keyPressed("LEFT"))
        {
            dir[0] -= 1;
        }
        if (this.game.keyboard.keyPressed("RIGHT"))
        {
            dir[0] += 1;
        }
        if (this.game.keyboard.keyPressed("UP") && !(this.game.keyboard.keyPressed("E") && this.canBuild))
        {
            dir[1] -= 1;
        }
        if (this.game.keyboard.keyPressed("DOWN") && !(this.game.keyboard.keyPressed("E") && this.canBuild))
        {
            dir[1] += 1;
        }

//        var vectorDir:any = this.mathDevice.v2Build(dir[0], dir[1]);
//        var normalizedDir:any = this.mathDevice.v2Normalize(vectorDir);

        var vectorLength:number = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
        if (vectorLength > 0) {
            var normalizedDir:number[] = [dir[0] / vectorLength, dir[1] / vectorLength];
            var pos:number[] = this.rigidSprite.body.getPosition();
            var nextPos:number[] = [pos[0] + (normalizedDir[0] * this.CLIMB_SPEED), pos[1] + (normalizedDir[1] * this.CLIMB_SPEED)];

            // XXX: this is dangerous teleportation! Could break physics engine
            this.rigidSprite.body.setPosition(nextPos);

            // if the player is going to move beyond the top of the climbable, stop them
            // don't know a better way to do this than to just move the object
            var witA:number[] = [];
            var witB:number[] = [];
            var axis:number[] = [];
            var dist = this.collisionUtil.signedDistance(this.climbableObject.getClimbableShape(), this.rigidSprite.body.shapes[0], witA, witB, axis);
            if (!this.climbableObject.isClimbableAtObjectPosition(this.collisionUtil, this.rigidSprite.body.shapes[0])
                && axis[1] < 0 && axis[0] * dist < this.DIST_EPSILON)
            {
                this.rigidSprite.body.setPosition(pos);
            }
        }

        // prevent drift
        var currentPos:number[] = this.rigidSprite.body.getPosition();
        if (this.lastClimbPosition != null)
        {
            currentPos[0] = (dir[0] == 0) ? this.lastClimbPosition[0] : currentPos[0];
            currentPos[1] = (dir[1] == 0) ? this.lastClimbPosition[1] : currentPos[1];
            this.rigidSprite.body.setPosition(currentPos);
        }

        // save current pos
        this.lastClimbPosition = currentPos;
    }

    update()
    {
        var oldTexture:AnimatedTexture = this.currentTexture;

        // reset rotation just in case
        this.rigidSprite.body.setRotation(0);

        // double check that we are on the ground
        var newOnGround:boolean = this.stillOnGround();
        if (newOnGround != this.onGround) {
            console.log("Switching onGround to " + newOnGround);
        }
        this.onGround = newOnGround;

        // reset back to last checkpoint when R is pressed
        if (this.game.keyboard.keyPressed("R"))
        {
            var resetPosition:number[] = this.game.checkpointManager.resetPosition();
            if (resetPosition != null) {
                this.rigidSprite.body.setPosition(resetPosition);
            }
        }

        // to be allowed to jump you either have to be climbing or have to be on the ground
        if (this.game.keyboard.keyPressed("SPACE") && (this.isClimbing || this.stillOnGround())) {
            this.rigidSprite.body.setAsDynamic();
            this.jumpUp();
        }
        // if we didn't jump and instead are climbing, move around
        else if (this.isClimbing) {
            this.climb();
        }

        // if we are not climbing (but we can be jumping) then move
        if (!this.isClimbing)
        {
            this.rigidSprite.body.setAsDynamic();
            // handle key presses
            if (this.game.keyboard.keyPressed("LEFT") && this.canMoveLeft())
            {
                this.walkLeft();
            }
            if (this.game.keyboard.keyPressed("RIGHT") && this.canMoveRight())
            {
                this.walkRight();
            }
            if (this.game.keyboard.keyPressed("UP") && !(this.game.keyboard.keyPressed("E") && this.canBuild))
            {
                this.goUp();
            }
            if (this.game.keyboard.keyPressed("DOWN") && !(this.game.keyboard.keyPressed("E") && this.canBuild))
            {
                this.goDown();
            }
        }

        if (!this.onGround)
        {
            this.currentTexture = this.jumpTexture;
        }
        else if (Math.abs(this.rigidSprite.body.getVelocity()[0]) < this.THRESHOLD_STANDING_SPEED)
        {
            this.currentTexture = this.standTexture;
        }

        // force the player to not fall due to gravity if they are climbing
        if (this.isClimbing)
        {
            var vel:number[] = this.rigidSprite.body.getVelocity();
            this.rigidSprite.body.setVelocity([vel[0], 0]);
        }

        // at the end of every update, erase climbing information.
        // If the player continues to intersect the object, then we'll detect that again before the next update
        if (!this.canClimb) {
            this.isClimbing = false;
        }
        this.canClimb = false;
        this.canBuild = false;

        if (oldTexture != this.currentTexture)
        {
            this.currentTexture.resetLoop();
        }
        if (this.currentTexture.texture) {
            this.setTexture(this.currentTexture.texture);
            this.setTextureRectangle(this.currentTexture.currentFrameRectangle(this.facing));
        }
    }

    // draws the player's sprite to the screen
    draw(draw2D:Draw2D, offset:number[])
    {
        this.rigidSprite.draw(draw2D, offset);
    }
}