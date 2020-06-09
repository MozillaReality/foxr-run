import * as THREE from "three";
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";


// textures

/*
const environmentMap = new THREE.TextureLoader().load(
  "assets/env.jpg"
);
environmentMap.mapping = THREE.EquirectangularReflectionMapping;
environmentMap.encoding = THREE.sRGBEncoding;
environmentMap.flipY = false;
*/
var textures = {};
const textureURLs = [
  'foxr_diff.png', 'foxr_emissive.png', 'foxr_opacity.png'
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
camera.position.set(0, 0.6, 1.1);
camera.lookAt(0,0.1,0);

var renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x88aacc)

document.body.appendChild(renderer.domElement);


const DEBUG = false;
var debug = document.createElement('div');
debug.className = 'debug';
document.body.appendChild(debug);
function debugStr(str) {
  if (!DEBUG) { return; }
  if (str===null) {
    debug.innerHTML = '';
    return;
  }
  debug.innerHTML += str + '<br>';
}

// window resize handler

window.addEventListener('resize', onResize);
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};
onResize();


var john = new THREE.Mesh(new THREE.SphereBufferGeometry(0.01));
//scene.add(john);

// controls

var controls = {up: false, down: false, left: false, right: false, jump: false};

document.addEventListener('keydown', onDesktopInputEvent);
document.addEventListener('keyup', onDesktopInputEvent);
document.addEventListener('mousedown', onDesktopInputEvent);
document.addEventListener('mouseup', onDesktopInputEvent);

function onDesktopInputEvent(ev) {
  if (ev.type === 'mouseup' || ev.type === 'mousedown') {
    controls.jump = ev.type === 'mousedown';
    return
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

// scene

var light = new THREE.HemisphereLight(0x6688ff, 0x227722, 1);
scene.add( light );
var light = new THREE.DirectionalLight(0xaaaaaa,1);
light.position.set(0.2, 1.7, 0.7);
light.castShadow = true;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.right = 10;
light.shadow.camera.left = -10;
light.shadow.mapSize.set(4096, 4096);
scene.add(light);

var tiles = null;
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

  // constants
  ACCELERATION: 0.15,
  FRICTION: 0.9,
  MAX_SPEED: 0.03,
  JUMP_SPEED: 0.03,
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

new GLTFLoader().load('assets/foxr.glb', gltf => {
  var foxrMesh = gltf.scene.getObjectByName('foxr');
  foxrMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.png'],
    emissiveMap: textures['foxr_diff.png'],
    skinning: true
  })

  foxrMesh.frustumCulled = false;
  foxrMesh.castShadow = true;

  var headsetMesh = gltf.scene.getObjectByName('foxr_headset');
  headsetMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.png'],
    emissiveMap: textures['foxr_diff.png'],
    alphaMap: textures['foxr_opacity.png'],
    transparent: true,
    skinning: true
  })

  headsetMesh.frustumCulled = false;

  //foxrMesh.material.map.encoding = THREE.LinearEncoding;


  foxr.object3D = gltf.scene.getObjectByName('Armature');
  scene.add(gltf.scene);

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

/*
  mixer.addEventListener('finished', e => {
    console.log('end jump animation');
    foxr.playAnim('idle');
  });
*/
  foxr.anims.jump.setLoop(THREE.LoopOnce);

  foxr.mixer = mixer;
  foxr.playAnim('idle');


  // floor

  tiles = gltf.scene.getObjectByName('tiles').children;
  for (var i = 0; i < tiles.length; i++) {
    //dtiles[i].castShadow = true;
    tiles[i].receiveShadow = true;
  }

  clock.start();
  animate();
});


const LOOK_AT_MUL = new THREE.Vector2(500, 500);
const FLOOR_LEVEL = 0.110539;

function reset() {
  foxr.speed.set(0, 0);
  foxr.jump = 0;
  foxr.onAir = true;
  foxr.object3D.position.set(0, 0.156169, 0);
}

function update(time, dt) {
  const acceleration = foxr.ACCELERATION * (foxr.onAir ? 0.8 : 1);
  if (controls.left) { foxr.speed.x -= acceleration * dt; }
  if (controls.right){ foxr.speed.x += acceleration * dt; }
  if (controls.up)   { foxr.speed.y -= acceleration * dt; }
  if (controls.down) { foxr.speed.y += acceleration * dt; }
  if (controls.jump && !foxr.onAir){
    foxr.jump = foxr.JUMP_SPEED;
    foxr.onAir = true;
  }

  var speed = foxr.speed.length();

  if (foxr.onAir){
    foxr.playAnim('jump');
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


  debugStr(`hola ${foxr.speed.x}, ${foxr.jump}, ${foxr.speed.y}`);


  foxr.speed.x *= foxr.FRICTION;
  foxr.speed.y *= foxr.FRICTION;

  foxr.jump -= 0.08 * dt;

  // apply to object3d
  foxr.object3D.position.x += foxr.speed.x;
  foxr.object3D.position.y += foxr.jump;
  foxr.object3D.position.z += foxr.speed.y;


  // collision with floor
  foxr.onAir = true;
  foxr.floorPoint.set(
    foxr.object3D.position.x,
    foxr.object3D.position.y - foxr.OFFSET_Y,
    foxr.object3D.position.z
    );

  foxr.bellyPoint.set(
    foxr.object3D.position.x + foxr.speed.x * 2,
    foxr.object3D.position.y,
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

  if (speed > 0.001) {
    const lookAt = foxr.speed.clone();
    lookAt.normalize().multiply(LOOK_AT_MUL);
    foxr.object3D.lookAt(lookAt.x, 0, lookAt.y);
  }

  if (foxr.speed.length() < 0.0001) { foxr.speed.set(0, 0); }

  camera.position.set(
    foxr.object3D.position.x,
    foxr.object3D.position.y * 0.5 + 0.5,
    foxr.object3D.position.z + 1.2,
    );

  camera.lookAt(
    foxr.object3D.position.x,
    foxr.object3D.position.y * 0.5,
    foxr.object3D.position.z
    );

}

// main loop
var clock = new THREE.Clock();
function animate(time) {
  debugStr(null);
  requestAnimationFrame(animate);
  var dt = clock.getDelta();

  // update foxr
  update(time, dt);

  foxr.mixer.update(dt);

  renderer.render(scene, camera);
};
