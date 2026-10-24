# Three.js with vanilla TypeScript, not React Three Fiber

The scene is an imperative assembly of hundreds of parametric meshes, custom
shaders and a precise mechanical rig. We use Three.js directly with Vite and
TypeScript: no React, no reconciler, no UI framework. R3F would add a state model
between us and the render loop without simplifying geometry generation, and the
page UI is simple enough for a few typed DOM controllers. The consequence is that
UI state (colourway, fold angle, quality) is owned by a small explicit store that
both the DOM and the scene subscribe to; that store is the test seam.

**Status:** accepted
