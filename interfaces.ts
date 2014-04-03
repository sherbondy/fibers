/// <reference path="jslib-modular/physics2d.d.ts" />
/// <reference path="jslib-modular/tzdraw2d.d.ts" />
/// <reference path="jslib-modular/turbulenz.d.ts" />

interface GameObject {
    engine : TurbulenzEngine;
    graphicsDevice : GraphicsDevice;
    inputDevice: InputDevice;
    draw2D : Draw2D;
    viewport : number[];
    physicsDevice : Physics2DDevice;
    physicsWorld : Physics2DWorld;
    debugMode : boolean;
}