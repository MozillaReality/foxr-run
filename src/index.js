
// import external libraries

// three.js
import * as THREE from "three";

// GLTFLoader from three.js examples, to be able to load GLTF files
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

// our local version of VRButton (a button to enter/exit VR)
import {VRButton} from './VRButton.js';

// XRControllerModelFactory from three.js examples, to load VR controller models
import {XRControllerModelFactory} from '../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';


// textures



var textures = {};
const textureURLs = [
  'env.jpg', 'foxr_diff.jpg', 'foxr_emissive.jpg', 'foxr_opacity.png', 'tiles.jpg', 'flare.png'
];
for (let i = 0; i < textureURLs.length; i++) {
  let tex = new THREE.TextureLoader().load(`assets/${textureURLs[i]}`);
  tex.encoding = THREE.sRGBEncoding;
  tex.flipY = false;
  textures[textureURLs[i]] = tex;
}

// renderer and camera

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0);

var cameraRig = new THREE.Group();
cameraRig.add(camera);
scene.add(cameraRig);


var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.gammaFactor = 2.2;
renderer.setPixelRatio( window.devicePixelRatio );
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.xr.enabled = true;
renderer.setClearColor(0x88aacc)

document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, status => {
  if (status === 'sessionStarted') {
    cameraRig.position.set(0, 0, 0.4);
  }
}));


// window resize handler
window.addEventListener('resize', onResize);
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
onResize();


var john = new THREE.Mesh(new THREE.SphereBufferGeometry(0.01));
//scene.add(john);

// controls
var controllers = { left: null, right: null };
var controls = {up: false, down: false, left: false, right: false, jump: false, canJump: true};

document.addEventListener('keydown', onDesktopInputEvent);
document.addEventListener('keyup', onDesktopInputEvent);
renderer.domElement.addEventListener('mousedown', onDesktopInputEvent);
renderer.domElement.addEventListener('mouseup', onDesktopInputEvent);

function onDesktopInputEvent(ev) {
  if (controls.canJump && ev.type === 'mousedown'){
    controls.jump = true;
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
      break;
    case 82: // r, reset
      reset();
      break;
  }
}


var flareMaterial = null;
var flares = [];

function createFlare(position){
  const geometry = new THREE.PlaneBufferGeometry(0.4, 0.4);
  if (!flareMaterial) {
    flareMaterial =  new THREE.MeshBasicMaterial({
      map: textures['flare.png'],
      blending: THREE.AdditiveBlending,
      depthTest: false
    });
  }
  const flare = new THREE.Mesh(geometry, flareMaterial);
  flare.up.set(0, 0, -1);
  flare.position.copy(position)
  flare.scale.set(0, 0, 0);
  flares.push(flare);
  return flare;
}



function processControllers() {
  const left = controllers.left.children[0].motionController;
  const right = controllers.right.children[0].motionController;
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
    axisX = axisXright;
    axisY = axisYright;
  }

  controls.jump = jump;
  controls.left = axisX < - 0.5;
  controls.right = axisX > 0.5;
  controls.down = axisY > 0.5;
  controls.up = axisY < - 0.5;
}

// scene

var light = new THREE.HemisphereLight(0xffffff, 0x666666, 0.4);
scene.add( light );
var light = new THREE.DirectionalLight(0xaaaaaa, 1.4);
light.position.set(0.2, 2.7, 0.7);
light.castShadow = true;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.right = 10;
light.shadow.camera.left = -10;
light.shadow.mapSize.set(4096, 4096);
scene.add(light);

var tiles = null;
var stars = null;
var arrowHelper = null;
/* floor
var geometry = new THREE.PlaneBufferGeometry(4, 4).rotateX(-Math.PI / 2);
var material = new THREE.MeshLambertMaterial({ color: 0x21351d });
var floor = new THREE.Mesh(geometry, material);
floor.receiveShadow = true;
scene.add(floor);
*/

// foxr object
var foxr = {
  object3D: null, // reference to the armature
  anims: null, // list of ClipActions
  mixer: null, // animation mixer
  currentAnim: null, // current ClipAction

  speed: new THREE.Vector2(), // speed vector on floor
  jump: 0, // jump speed
  onAir: true, // is jumping or falling
  floorPoint: new THREE.Vector3(), // point in his feet, to calculate colision with the floor
  bellyPoint: new THREE.Vector3(), // point in his bellybutton, to calculate colision with the walls
  bb: new THREE.Box3(), // bounding box for colliding with stars
  BBSIZE: new THREE.Vector3(0.2, 0.25, 0.2),
  // constants
  ACCELERATION: 0.15,
  FRICTION: 0.9,
  MAX_SPEED: 0.03,
  JUMP_SPEED: 0.032,
  OFFSET_Y: 0.046169
};

window.foxr = foxr;

foxr.playAnim = (anim) => {
  if (foxr.currentAnim && foxr.currentAnim._clip.name === anim) return;

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
  } else foxr.anims[anim].play();

  foxr.currentAnim = foxr.anims[anim];
}

// load and setup scene

new GLTFLoader().load('assets/background.glb', gltf => {
  const cloudsMaterial = gltf.scene.getObjectByName("clouds").material;
  cloudsMaterial.transparent = true;
  cloudsMaterial.fog = false;
  const skyMaterial = gltf.scene.getObjectByName("sky").material;
  skyMaterial.fog = false;
  scene.add(gltf.scene);
});

new GLTFLoader().load('assets/scene.glb', gltf => {
  var foxrMesh = gltf.scene.getObjectByName('foxr');
  foxrMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.jpg'],
    emissiveMap: textures['foxr_diff.jpg'],
    skinning: true
  })

  foxrMesh.frustumCulled = false;
  foxrMesh.castShadow = true;

  var headsetMesh = gltf.scene.getObjectByName('foxr_headset');
  headsetMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.jpg'],
    emissiveMap: textures['foxr_diff.jpg'],
    alphaMap: textures['foxr_opacity.png'],
    transparent: true,
    skinning: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })

  headsetMesh.frustumCulled = false;

  foxr.object3D = gltf.scene.getObjectByName('Armature');
  scene.add(gltf.scene);
  foxr.object3D.position.z = -0.5;

  // animations

  let mixer = new THREE.AnimationMixer(foxrMesh);
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

  foxr.anims.jump.setLoop(THREE.LoopOnce);

  foxr.mixer = mixer;
  foxr.playAnim('idle');


  // floor

  const tileMaterial = new THREE.MeshLambertMaterial({
    map: textures['tiles.jpg']
  });
  tiles = gltf.scene.getObjectByName('tiles2').children;
  for (var i = 0; i < tiles.length; i++) {
    //tiles[i].castShadow = true;
    tiles[i].receiveShadow = true;
    // move tiles up to 1m high (around waist)
    tiles[i].position.y += 1;
    // move bb to the position of the tile
    tiles[i].geometry.boundingBox.translate(tiles[i].position);
    tiles[i].material = tileMaterial
  }

  // stars

  const envTexture = textures['env.jpg'];
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.encoding = THREE.sRGBEncoding;
  envTexture.flipY = true;
  const starMaterial = new THREE.MeshPhongMaterial({
    color: 0xffaa00,
    reflectivity: 0.8,
    emissive: 0xaa7700,
    envMap: envTexture
  });
  stars = gltf.scene.getObjectByName('stars').children;
  for (var i = 0; i < stars.length; i++) {
    stars[i].castShadow = true;
    stars[i].material = starMaterial;
    // move stars up to 1m high (around waist)
    stars[i].position.y += 1;
    stars[i].geometry.boundingBox.translate(stars[i].position);
    stars[i].userData.flare = createFlare(stars[i].position);
    stars[i].userData.initialPositionY = stars[i].position.y;
    scene.add(stars[i].userData.flare);
  }


  // controllers
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

  clock.start();
  renderer.setAnimationLoop(animate);
});



const LOOK_AT_MUL = new THREE.Vector2(500, 500);
const FLOOR_LEVEL = 0.110539;

function reset() {
  foxr.speed.set(0, 0);
  foxr.jump = 0;
  foxr.onAir = true;
  controls.jump = false;
  controllers.canJump = true;
  foxr.object3D.position.set(0, 1.4, -0.7);
}

function update(time, dt) {
  const acceleration = foxr.ACCELERATION * (foxr.onAir ? 0.6 : 1);
  if (controls.left) { foxr.speed.x -= acceleration * dt; }
  if (controls.right){ foxr.speed.x += acceleration * dt; }
  if (controls.up)   { foxr.speed.y -= acceleration * dt; }
  if (controls.down) { foxr.speed.y += acceleration * dt; }
  if (controls.jump && controls.canJump && !foxr.onAir){
    foxr.jump = foxr.JUMP_SPEED;
    controls.canJump = false;
    foxr.onAir = true;
  }

  var speed = foxr.speed.length();

  if (foxr.onAir){
    if (Math.abs(foxr.jump) > 0.01) foxr.playAnim('jump');
  }
  else if (speed > 0.005){
    foxr.playAnim('run');
  } else {
    foxr.playAnim('idle');
  }

  foxr.anims.run.timeScale = Math.max(0.5, speed * 70);

  if (speed > foxr.MAX_SPEED){
    foxr.speed.normalize().multiplyScalar(foxr.MAX_SPEED);
  }

  foxr.speed.x *= foxr.FRICTION;
  foxr.speed.y *= foxr.FRICTION;

  foxr.jump -= 0.08 * dt;

  // apply to object3d
  foxr.object3D.position.x += foxr.speed.x;
  foxr.object3D.position.y += foxr.jump;
  foxr.object3D.position.z += foxr.speed.y;


  if (foxr.object3D.position.y < 0){
    reset();
    return;
  }

  // collision with floor
  foxr.onAir = true;
  foxr.floorPoint.set(
    foxr.object3D.position.x,
    foxr.object3D.position.y - foxr.OFFSET_Y,
    foxr.object3D.position.z
    );

  foxr.bellyPoint.set(
    foxr.object3D.position.x + foxr.speed.x * 2,
    foxr.object3D.position.y + 0.02,
    foxr.object3D.position.z + foxr.speed.y * 2
    );

  for (var i = 0; i < tiles.length; i++) {
    const bb = tiles[i].geometry.boundingBox;
    if (bb.containsPoint(foxr.bellyPoint)){
      foxr.object3D.position.x -= foxr.speed.x * 1.1;
      foxr.object3D.position.z -= foxr.speed.y * 1.1;
      foxr.speed.set(0, 0);
      speed = 0;
    }
    else if (bb.containsPoint(foxr.floorPoint)){
      foxr.object3D.position.y = bb.max.y + foxr.OFFSET_Y;
      foxr.jump = 0;
      foxr.onAir = false;
      break;
    }
  }

  // picking stars

  foxr.bb.setFromCenterAndSize(foxr.object3D.position, foxr.BBSIZE); // update bounding box
  for (var i = 0; i < stars.length; i++) {
    if (stars[i].visible && foxr.bb.containsPoint(stars[i].position)){
      stars[i].userData.flare.scale.addScalar(0.05);
      stars[i].visible = false;
    }
  }

  if (!foxr.onAir) {
    controls.canJump = true;
    controls.jump = false;
  }


  if (speed > 0.001) {
    const lookAt = foxr.speed.clone();
    lookAt.normalize().multiply(LOOK_AT_MUL);
    foxr.object3D.lookAt(lookAt.x, 0, lookAt.y);
  }

  if (foxr.speed.length() < 0.0001) { foxr.speed.set(0, 0); }

  if (!renderer.xr.isPresenting){
    cameraRig.position.set(
      foxr.object3D.position.x,
      foxr.object3D.position.y * 0.7 - 0.7,
      foxr.object3D.position.z + 0.9,
      );

    camera.lookAt(
      foxr.object3D.position.x,
      foxr.object3D.position.y,
      foxr.object3D.position.z
      );
  }
}

function animateStars(time, dt){
  for (var i = 0; i < stars.length; i++) {
    const star = stars[i];
    star.rotation.x = time / 945;
    star.rotation.y = time / 250;
    star.rotation.z = time / 1205;
    star.position.y = star.userData.initialPositionY + Math.sin( (time + i * 50) / 200) * 0.03;
  }
}

function animateFlares(time, dt){
  for (var i = 0; i < flares.length; i++) {
    const flare = flares[i];
    if (flare.scale.x > 0){
      const s = flare.scale.x + 3 * dt;//(1 - flare.scale.x) * 5 * dt;
      flare.scale.set(s, s, s);
      flare.lookAt(
        cameraRig.position.x + camera.position.x,
        cameraRig.position.y + camera.position.y,
        cameraRig.position.z + camera.position.z
      );
      if (flare.scale.x > 1){
        flare.scale.multiplyScalar(0);
      }
    }
  }
}

// main loop
var clock = new THREE.Clock();
function animate(time) {
  var dt = clock.getDelta();

  if (renderer.xr.isPresenting){
    processControllers();
  }

  update(time, dt);
  foxr.mixer.update(dt);

  animateStars(time, dt);
  animateFlares(time, dt);

  renderer.render(scene, camera);
};
