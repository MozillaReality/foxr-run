
import * as THREE from "three";
import {textures, cameraRig, camera} from './index.js';

var flareMaterial = null;
var flares = [];
var stars = null;


export function createFlare(position){
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

export function animateFlares(time, dt){
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


export function prepareStars(gltf, scene){
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
}

export function animateStars(time, dt){
  for (var i = 0; i < stars.length; i++) {
    const star = stars[i];
    star.rotation.x = time / 945;
    star.rotation.y = time / 250;
    star.rotation.z = time / 1205;
    star.position.y = star.userData.initialPositionY + Math.sin( (time + i * 50) / 200) * 0.03;
  }
}

export function checkCollisions(bb) {
  for (var i = 0; i < stars.length; i++) {
    if (stars[i].visible && bb.containsPoint(stars[i].position)){
      stars[i].userData.flare.scale.addScalar(0.05);
      stars[i].visible = false;
    }
  }
}
