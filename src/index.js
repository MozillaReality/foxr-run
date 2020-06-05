import * as THREE from "three";
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

var renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);
onResize();

window.addEventListener('resize', onResize);
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};

var geometry = new THREE.PlaneBufferGeometry(4, 4).rotateX(-Math.PI / 2);
var material = new THREE.MeshBasicMaterial({ color: 0x8888ff });
var floor = new THREE.Mesh(geometry, material);
scene.add(floor);

var animate = function () {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
};

animate();
