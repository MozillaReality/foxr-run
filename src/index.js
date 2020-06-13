
// import libraries

// three.js
import * as THREE from "three";

// GLTFLoader from three.js examples, to be able to load GLTF files
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
// our local version of VRButton (a button to enter/exit VR)
import {VRButton} from './VRButton.js';
// XRControllerModelFactory from three.js examples, to load VR controller models
import {XRControllerModelFactory} from '../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
// stuff related to stars and flares
import * as Stars from './stars.js';

// Preload textures and save references in `textures` object

var textures = {};
const textureURLs = [
  'env.jpg',
  'foxr_diff.jpg',
  'foxr_emissive.jpg',
  'foxr_opacity.png',
  'tiles.jpg',
  'flare.png'
];

for (let i = 0; i < textureURLs.length; i++) {
  let tex = new THREE.TextureLoader().load(`assets/${textureURLs[i]}`);
  tex.encoding = THREE.sRGBEncoding;
  tex.flipY = false;
  textures[textureURLs[i]] = tex;
}


// global vars

var scene, camera, cameraRig, renderer, audioListener;
var foxr;  // foxr object
var tiles; // reference to the parent object of all tiles

// user controllers and controls states
var controllers = { left: null, right: null }; // this will be populated later
var controls = {up: false, down: false, left: false, right: false, jump: false, canJump: true};

// app clock
var clock = new THREE.Clock();

// main entry function

function init() {
  var ambientLight, sunLight;

  // create scene and camera

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  // create an AudioListener and add it to the camera
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // we add the camera to a group, so we can move it in VR,
  // independently of the headset position

  cameraRig = new THREE.Group();
  cameraRig.add(camera);
  scene.add(cameraRig);

  // create renderer

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.gammaFactor = 2.2;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.xr.enabled = true; // we want this available in XR!
  document.body.appendChild(renderer.domElement);

  // add VRButton to the page, with a function called whenever the user
  // enters or exits VR. In this case, in VR we want to place the user/camera
  // in a specific fixed spot

  document.body.appendChild(VRButton.createButton(renderer, status => {
    if (status === 'sessionStarted') {
      cameraRig.position.set(0, 0, 0.4);
    }
  }));

  // add lights

  ambientLight = new THREE.HemisphereLight(0xffffff, 0x666666, 0.4);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xaaaaaa, 1.4);
  sunLight.position.set(0.2, 2.7, 0.7);
  sunLight.castShadow = true;
  sunLight.shadow.camera.top = 10;
  sunLight.shadow.camera.bottom = -10;
  sunLight.shadow.camera.right = 10;
  sunLight.shadow.camera.left = -10;
  sunLight.shadow.mapSize.set(4096, 4096);
  scene.add(sunLight);


  // create controller models

  const controllerModelFactory = new XRControllerModelFactory();

  const controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.addEventListener('connected', (event) => {
    controllers[event.data.handedness] = controllerGrip1;
  });
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));

  const controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  controllerGrip2.addEventListener('connected', (event) => {
    controllers[event.data.handedness] = controllerGrip2;
  });
  cameraRig.add(controllerGrip1);
  cameraRig.add(controllerGrip2);


  // Handlers

  // window resize handler
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', onResize);
  onResize(); // call it on start

  // send keyboard and mouse events to processDesktopControls()
  document.addEventListener('keydown', processDesktopControls);
  document.addEventListener('keyup', processDesktopControls);
  renderer.domElement.addEventListener('mousedown', processDesktopControls);
  renderer.domElement.addEventListener('mouseup', processDesktopControls);

  // load and process gLTF models
  loadBackground();
  loadScene();

  // load background music
  var music = new THREE.Audio(audioListener);
  new THREE.AudioLoader().load('assets/music.ogg', function(buffer) {
    music.setBuffer(buffer);
    music.setLoop(true);
    music.setVolume(0.04);
    music.play();
  });
}

init(); // call init ↑


/** INIT FOXR OBJECT **/

foxr = {
  object3D: null,     // reference to the armature
  anims: null,        // list of ClipActions
  mixer: null,        // animation mixer
  currentAnim: null,  // current ClipAction
  sounds: {},         // sounds set
  currentSound: null, // current sound

  speed: new THREE.Vector2(), // speed vector on floor
  jump: 0,                    // jump speed
  onAir: true,                // is jumping or falling

  lookAt: new THREE.Vector2(),

  // point in his feet, to calculate colision with the floor
  floorPoint: new THREE.Vector3(),
  // point in his bellybutton, to calculate colision with the walls
  bellyPoint: new THREE.Vector3(),
  // bounding box for colliding with stars
  bb: new THREE.Box3(),
  // size of bb
  BBSIZE: new THREE.Vector3(0.2, 0.25, 0.2),

  // constants
  ACCELERATION: 0.15,   // running acceleration
  FRICTION: 0.9,        // running deceleration
  MAX_SPEED: 0.03,      // max running speed
  JUMP_SPEED: 0.032,    // jump force
  GRAVITY_FACTOR: 0.08, // gravity force
  OFFSET_Y: 0.046169,   // Y position of the skeleton, relative to the feet

  // scaling vector to change Foxr viewing direction
  LOOK_AT_MUL: new THREE.Vector2(500, 500)
};

// function to play an animation in foxr

foxr.playAnim = function (anim) {

  // ignore if current animation is `anim` already
  if (foxr.currentAnim && foxr.currentAnim._clip.name === anim) return;

  // if there's a current animation, cross fade between that and the new one.
  if (foxr.currentAnim) {
    const anim1 = foxr.currentAnim;
    const anim2 = foxr.anims[anim];

    anim1.enabled = true;
    anim1.setEffectiveTimeScale(1);
    anim1.setEffectiveWeight(1);

    anim2.enabled = true;
    anim2.setEffectiveTimeScale(1);
    anim2.setEffectiveWeight(1);

    anim2.time = 0;
    anim1.crossFadeTo(anim2, 0.3)

  } else {
    foxr.anims[anim].play();
  }

  foxr.currentAnim = foxr.anims[anim];
};

// function to play a foxr sound

foxr.playSound = function (sound) {
  // ignore if same sound is currently playing
  if (foxr.currentSound == sound) { return; }
  // stop all sounds
  for (let i in foxr.sounds) {
    foxr.sounds[i].pause();
  }
  // play requested sound
  if (sound) {
    foxr.sounds[sound].offset = 0;
    foxr.sounds[sound].play();
  }
  foxr.currentSound = sound;
}


// function to reset foxr position and state
foxr.reset = function () {
  foxr.speed.set(0, 0);
  foxr.jump = 0;
  foxr.onAir = true;
  controls.jump = false;
  controllers.canJump = true;
  foxr.object3D.position.set(0, 1.4, -0.7);
}


/** SCENE LOADING and SETUP **/

// load background (blue floor and sky)

function loadBackground() {

  new GLTFLoader().load('assets/background.glb', gltf => {

    const cloudsMaterial = gltf.scene.getObjectByName("clouds").material;
    cloudsMaterial.transparent = true;
    cloudsMaterial.fog = false;

    const skyMaterial = gltf.scene.getObjectByName("sky").material;
    skyMaterial.fog = false;
    scene.add(gltf.scene);
  });
}


// load scene with Foxr, floor blocks and stars

function loadScene() {

  new GLTFLoader().load('assets/scene.glb', gltf => {

    // setup foxr material
    const foxrMesh = gltf.scene.getObjectByName('foxr');
    foxrMesh.material = new THREE.MeshLambertMaterial({
      map: textures['foxr_diff.jpg'],
      emissiveMap: textures['foxr_diff.jpg'],
      skinning: true
    })

    foxrMesh.castShadow = true;

    // setup foxr headset material
    const headsetMesh = gltf.scene.getObjectByName('foxr_headset');
    headsetMesh.material = new THREE.MeshLambertMaterial({
      map: textures['foxr_diff.jpg'],
      emissiveMap: textures['foxr_diff.jpg'],
      alphaMap: textures['foxr_opacity.png'],
      transparent: true,
      skinning: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })

    // we need to disable frustum culling for Foxr meshes because the camera
    // will follow the skeleton, not the mesh. Is the skinning process the one
    // that deforms the vertices of the meshes, the mesh object3d.position will
    // be the same all the time.

    foxrMesh.frustumCulled = false;
    headsetMesh.frustumCulled = false;

    // Get Foxr skeleton and save it's reference in foxr.object3D. It's the
    // skeleton what we will move around the scene

    foxr.object3D = gltf.scene.getObjectByName('Armature');
    foxr.object3D.position.z = -0.5;

    // setup animations

    const mixer = new THREE.AnimationMixer(foxrMesh);
    foxr.anims = {
      jump : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "jump")),
      run : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "run")),
      idle : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "idle")),
    };

    for (let i in foxr.anims){
      foxr.anims[i].enabled = true;
      foxr.anims[i].setEffectiveWeight(0);
      foxr.anims[i].setEffectiveTimeScale(1);
      foxr.anims[i].play();
    }
    foxr.anims.idle.setEffectiveWeight(1);

    // jump animation doesn't loop
    foxr.anims.jump.setLoop(THREE.LoopOnce);

    // save a reference of the mixer, to switch between animations
    foxr.mixer = mixer;

    // play idle animation
    foxr.playAnim('idle');


    // load foxr sounds
    const sounds = ['jump', 'run', 'walk'];
    const audioLoader = new THREE.AudioLoader();
    for (let i = 0; i < sounds.length; i++) {
      const soundName = sounds[i];
      audioLoader.load('assets/' + soundName + '.ogg', function(audioBuffer) {
        const sound = new THREE.PositionalAudio(audioListener);
        sound.setBuffer(audioBuffer);
        if (soundName != 'jump') {
          sound.loop = true;
        }
        sound.setRefDistance(0.5); // distance where the sound starts to fade
        foxr.object3D.add(sound);
        foxr.sounds[soundName] = sound; // save reference to sound
      });
    }


    // floor blocks

    // Initially I had all 1x1 block tiles separated in the scene
    // a la minecraft, but it was really innecessary and very inefficient
    // (it would spawn hundreds of drawcalls), so I opted for join them into
    // large chunks (you can see them in the .blend file)

    const tileMaterial = new THREE.MeshLambertMaterial({
      map: textures['tiles.jpg']
    });

    tiles = gltf.scene.getObjectByName('tiles').children;
    for (let i = 0; i < tiles.length; i++) {
      // apply material
      tiles[i].material = tileMaterial
      // receive shadows
      tiles[i].receiveShadow = true;
      // move tiles up to 1m high (around waist)
      tiles[i].position.y += 1;
      // move bounding box to the position of the tile (for collisions)
      tiles[i].geometry.boundingBox.translate(tiles[i].position);
    }

    // prepare stars materials and properties (stars.js)
    Stars.prepareStars(gltf, scene);

    // add all the gltf to the scene
    scene.add(gltf.scene);

    // after the scene is loaded and prepared,
    // we can start the clock and the main loop
    clock.start();
    renderer.setAnimationLoop(animate);
  });
}

/** CONTROLS **/

function processDesktopControls(ev) {
  if (controls.canJump && ev.type === 'mousedown'){
    controls.jump = true;
    if (!foxr.onAir) { foxr.playSound('jump'); }
    return;
  }
  if (ev.type === 'mouseup') {
    controls.jump = false;
    controls.canJump = true;
    return;
  }
  const pressed = ev.type === 'keydown';
  switch(ev.keyCode){
    case 38: // up
    case 87: // w
      controls.up = pressed;
      break;
    case 40: // down
    case 83: // s
      controls.down = pressed;
      break;
    case 37: // left
    case 65: // a
      controls.left = pressed;
      break;
    case 39: // right
    case 68: // d
      controls.right = pressed;
      break;
    case 32: // space
    case 69: // e
      controls.jump = pressed;
      if (!foxr.onAir && pressed) { foxr.playSound('jump'); }
      break;
    case 82: // r, reset
      foxr.reset();
      break;
  }
}

// read VR controllers buttons, and set controls.<flag> accordingly
// both controllers can control foxr

function processVRControls() {
  const left = controllers.left.children[0].motionController;
  const right = controllers.right.children[0].motionController;
  // controllers not available
  if(!left || !right) { return; }

  const jump =
    left.components['xr-standard-trigger'].values.state === 'pressed' ||
    right.components['xr-standard-trigger'].values.state === 'pressed';

  const axisXleft = left.components["xr-standard-thumbstick"].values.xAxis;
  const axisYleft = left.components["xr-standard-thumbstick"].values.yAxis;
  const axisXright = right.components["xr-standard-thumbstick"].values.xAxis;
  const axisYright = right.components["xr-standard-thumbstick"].values.yAxis;

  let axisX, axisY;

  // currently using left thumbstick
  if (axisXleft || axisYleft) {
    axisX = axisXleft;
    axisY = axisYleft;
  } else {
    // using right thumbstick
    axisX = axisXright;
    axisY = axisYright;
  }

  if (controls.canJump && jump) {
    controls.jump = true;
    foxr.playSound('jump');
  }

  // axis go from -1 to 1
  controls.left = axisX < - 0.5;
  controls.right = axisX > 0.5;
  controls.down = axisY > 0.5;
  controls.up = axisY < - 0.5;
}


/** UPDATE FOXR POSITION AND CHECK COLLISIONS **/

function updateFoxr(time, dt) {

  // while on air, move slower sideways
  const acceleration = foxr.ACCELERATION * (foxr.onAir ? 0.6 : 1);

  // modify run speed depending on controls
  if (controls.left) { foxr.speed.x -= acceleration * dt; }
  if (controls.right){ foxr.speed.x += acceleration * dt; }
  if (controls.up)   { foxr.speed.y -= acceleration * dt; }
  if (controls.down) { foxr.speed.y += acceleration * dt; }

  // jump
  if (controls.jump && controls.canJump && !foxr.onAir){
    foxr.jump = foxr.JUMP_SPEED;
    controls.canJump = false;
    foxr.onAir = true;
  }

  // speed module/quantity (how fast foxr is running independently of direction)
  var speed = foxr.speed.length();

  // if on air, play animation 'jump'
  if (foxr.onAir){
    if (Math.abs(foxr.jump) > 0.01) foxr.playAnim('jump');
  }
  // If not on air, and moving more than a threshold, play animation 'run'
  // Also, depending on the speed, play walk or run sounds (or none)
  else {
      if (speed > 0.02){
      foxr.playSound('run');
    } else if (speed > 0.005){
      foxr.playAnim('run');
      foxr.playSound('walk');
    } else {
      foxr.playAnim('idle');
      foxr.playSound(null);
    }
  }

  // modify run animation playback speed depending on how fast it is moving
  foxr.anims.run.timeScale = Math.max(0.5, speed * 70);

  // clamp speed
  if (speed > foxr.MAX_SPEED){
    foxr.speed.normalize().multiplyScalar(foxr.MAX_SPEED);
  }

  // slowdown
  foxr.speed.x *= foxr.FRICTION;
  foxr.speed.y *= foxr.FRICTION;

  // decrease jump up force with a gravity factor
  foxr.jump -= foxr.GRAVITY_FACTOR * dt;

  // apply speeds to skeleton, effectively moving Foxr
  foxr.object3D.position.x += foxr.speed.x;
  foxr.object3D.position.y += foxr.jump;
  foxr.object3D.position.z += foxr.speed.y;


  // if fell out of the limits, reset
  if (foxr.object3D.position.y < 0){
    foxr.reset();
    return;
  }


  // check collision with floor and walls

  // Foxr collision system is very rudimentary and basic, by checking
  // if a single point under Foxr's feet or in front of Foxr's
  // bellybutton are inside the bounding box of an element of the scene

  const foxrPos = foxr.object3D.position; // cache position

  foxr.onAir = true; // assume we are on air

  // update floorPoint helper position
  foxr.floorPoint.set(foxrPos.x, foxrPos.y - foxr.OFFSET_Y, foxrPos.z);

  // update bellyPoint helper position
  // (the faster Foxr runs, the further we check for wall collisions)
  foxr.bellyPoint.set(
    foxrPos.x + foxr.speed.x * 2,
    foxrPos.y + 0.02,
    foxrPos.z + foxr.speed.y * 2
  );

  // for each ground block, check if bellyPoint or floorPoint
  // are inside its bounding box
  for (let i = 0; i < tiles.length; i++) {
    const bb = tiles[i].geometry.boundingBox;

    // detected collision with wall, move backwards and stop
    if (bb.containsPoint(foxr.bellyPoint)){
      foxrPos.x -= foxr.speed.x * 1.1;
      foxrPos.z -= foxr.speed.y * 1.1;
      foxr.speed.set(0, 0);
      speed = 0;
    }
    // detected collision with floor, stick Foxr to it and stop falling
    else if (bb.containsPoint(foxr.floorPoint)){
      foxrPos.y = bb.max.y + foxr.OFFSET_Y;
      foxr.jump = 0;
      foxr.onAir = false; // nope, not on air, found a collision
      break; // no need to keep looking for more floors
    }
  }

  // pick stars (stars.js)
  foxr.bb.setFromCenterAndSize(foxr.object3D.position, foxr.BBSIZE); // update bounding box
  Stars.checkCollisions(foxr.bb);

  // reset jump vars after collision checking
  if (!foxr.onAir) {
    controls.canJump = true;
    controls.jump = false;
  }

  // make foxr look accordingly to the moving direction
  if (speed > 0.001) {
    foxr.lookAt.copy(foxr.speed);
    foxr.lookAt.normalize().multiply(foxr.LOOK_AT_MUL);
    foxr.object3D.lookAt(foxr.lookAt.x, 0, foxr.lookAt.y);
  }

  // if almost stopped, stop!
  if (speed < 0.0001) { foxr.speed.set(0, 0); }
}


// update camera position to follow Foxr

function updateCamera() {
  const foxrPos = foxr.object3D.position;
  cameraRig.position.set(foxrPos.x, foxrPos.y * 0.7 - 0.7, foxrPos.z + 0.9);
  camera.lookAt(foxrPos.x, foxrPos.y, foxrPos.z);
}


/** MAIN LOOP **/

function animate(time) {
  var dt = clock.getDelta(); // time passed since previous frame

  // if in VR, read vr controller inputs
  if (renderer.xr.isPresenting){
    processVRControls();
  }

  // update foxr position and check collisions
  updateFoxr(time, dt);

  // if not in vr, update camera position to follow Foxr
  if (!renderer.xr.isPresenting){
    updateCamera();
  }

  // update foxr animations
  foxr.mixer.update(dt);

  // update stars and flare animations
  Stars.animateStars(time, dt);
  Stars.animateFlares(time, dt);

  renderer.render(scene, camera);
};


// export these to stars.js

export {textures, cameraRig, camera, audioListener};
