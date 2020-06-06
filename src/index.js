import * as THREE from "three";
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

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

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-2, 1.6, 3);
camera.lookAt(0,1,0);

var renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x66aaff)
//renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);
window.addEventListener('resize', onResize);
document.addEventListener('keydown', onKeyDown);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};

onResize();


function onKeyDown(ev) {
  if (ev.keyCode == 32) {
    playAnim('jump');
  } else if (ev.keyCode == 13) {
    playAnim('run');
  }
}

var light = new THREE.HemisphereLight(0x6688ff, 0x227722, 1);
scene.add( light );

var light = new THREE.HemisphereLight(0x6688ff, 0x227722, 1);
scene.add( light );
var light = new THREE.DirectionalLight(0xaaaaaa);
light.position.set(0.2, 1.7, -0.7);
light.castShadow = true;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.right = 10;
light.shadow.camera.left = -10;
light.shadow.mapSize.set(4096, 4096);
scene.add(light);

var geometry = new THREE.PlaneBufferGeometry(4, 4).rotateX(-Math.PI / 2);
var material = new THREE.MeshLambertMaterial({ color: 0x004411 });
var floor = new THREE.Mesh(geometry, material);
floor.receiveShadow = true;
scene.add(floor);

var foxr, foxrMesh;

new GLTFLoader().load('assets/foxr.glb', gltf => {
  foxrMesh = gltf.scene.getObjectByName('foxr');
  foxrMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.png'],
    emissiveMap: textures['foxr_diff.png'],
    skinning: true
  })
  foxrMesh.castShadow = true;

  var headsetMesh = gltf.scene.getObjectByName('foxr_headset');
  headsetMesh.material = new THREE.MeshLambertMaterial({
    map: textures['foxr_diff.png'],
    emissiveMap: textures['foxr_diff.png'],
    alphaMap: textures['foxr_opacity.png'],
    transparent: true,
    skinning: true
  })

  foxr = new THREE.Object3D();
  foxr.name = 'Foxr';
  foxr.add(foxrMesh);
  scene.add(foxr);
  scene.add(gltf.scene);


  let mixer = new THREE.AnimationMixer(foxrMesh);
  foxr.anims = {
    idle : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "idle")),
    run : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "run")),
    jump : mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "jump")),
  };
  mixer.addEventListener('finished', e => {
    playAnim('idle');
  });
  foxr.anims.jump.setLoop(THREE.LoopOnce);

  foxr.currentAnim = foxr.anims.idle;
  foxr.mixer = mixer;
  playAnim('run');
  clock.start();
  animate();
});


function playAnim(anim){
  foxr.currentAnim.stop();
  foxr.currentAnim = foxr.anims[anim];
  foxr.currentAnim.play();
}
window.playAnim = playAnim;

var clock = new THREE.Clock();

function animate(time) {
  requestAnimationFrame(animate);
  if (foxr) {
    foxr.mixer.update(clock.getDelta());
    foxr.position.y = Math.sin(time/800)
  }
  renderer.render(scene, camera);
};
