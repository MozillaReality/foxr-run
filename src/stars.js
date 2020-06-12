// three.js library
import * as THREE from "three";
// import these objects from index.js
import {textures, cameraRig, camera} from './index.js';

var flares = []; // array of flares
var stars = null; // reference to the parent of all the stars
var flareMaterial = null; // cached flareMaterial

// Stars are created in blender and come in scene.gltf. However, flares are
// created on the fly, one for each star. This function creates one flare in
// an specific position and adds it to `flares` array.

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
  flare.up.set(0, 0, -1); // up vector, for flare.lookAt()
  flare.position.copy(position);
  // flares are invisible, 0-sized by default. When animated, they grow.
  flare.scale.set(0, 0, 0);
  flares.push(flare);
  return flare;
}

// animate scale and orientation of the flares, if the flare
// animation was triggered (this happens in checkCollisions(), when setting
// a non-zero scale

export function animateFlares(time, dt){
  for (var i = 0; i < flares.length; i++) {
    const flare = flares[i];
    // if animation triggered
    if (flare.scale.x > 0){
      const s = flare.scale.x + 3 * dt; // scale increase
      flare.scale.set(s, s, s);
      // look at camera (billboard)
      flare.lookAt(
        cameraRig.position.x + camera.position.x,
        cameraRig.position.y + camera.position.y,
        cameraRig.position.z + camera.position.z
      );
      // flare's scale reached a limit, hide it (end of animation)
      if (flare.scale.x > 1){
        flare.scale.multiplyScalar(0);
        flare.userData.star.visible = false;
        flare.visible = false;
      }
    }
  }
}

// traverse all stars in the gltf scene and set materials and properties

export function prepareStars(gltf, scene){
  // create environment texture (for reflections)
  const envTexture = textures['env.jpg'];
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.encoding = THREE.sRGBEncoding;
  envTexture.flipY = true;

  // star material (shared for all stars)
  const starMaterial = new THREE.MeshPhongMaterial({
    color: 0xffaa00,
    reflectivity: 0.8,
    emissive: 0xaa7700,
    envMap: envTexture
  });

  // save reference to the parent object, to traverse later
  stars = gltf.scene.getObjectByName('stars').children;

  for (var i = 0; i < stars.length; i++) {
    const star = stars[i];

    star.castShadow = true;
    star.material = starMaterial;

    // move stars up to 1m high (around waist)
    star.position.y += 1;
    // move bounding box to the position of the star, to check collisions
    star.geometry.boundingBox.translate(star.position);
    // create flare for this star, and save reference
    star.userData.flare = createFlare(star.position);
    // save reference to the star in the flare
    star.userData.flare.userData.star = star;
    // save Y position, to animate later
    star.userData.initialPositionY = star.position.y;
    // add flare to the scene
    // (the star is added with the whole scene, in index.js)
    scene.add(star.userData.flare);
  }
}

// animate position and rotation of the star

export function animateStars(time, dt){
  for (var i = 0; i < stars.length; i++) {
    const star = stars[i];
    if (!star.visible) { continue; }
    star.rotation.x = time / 945;
    star.rotation.y = time / 250;
    star.rotation.z = time / 1205;
    star.position.y =
          star.userData.initialPositionY +
          Math.sin( (time + i * 50) / 200) * 0.03;
  }
}

// check star collision with a bounding box bb (foxr's)

export function checkCollisions(bb) {
  for (var i = 0; i < stars.length; i++) {
    if (stars[i].visible && bb.containsPoint(stars[i].position)){
      // if collided, start flare animation
      // (setting the scale to a non-zero value)
      stars[i].userData.flare.scale.addScalar(0.05);
    }
  }
}
