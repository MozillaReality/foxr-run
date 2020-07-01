## 00 PLAN

Hi! This is Diego, from Mozilla Mixed Reality. I've recently made a quick and
tiny demo where you can control our mascot, Foxr, running and jumping and
catching some stars that are floating around. It works in desktop, mobile and VR browsers

The demo is very, very basic, although it covers a lot of things that are needed to
make an interesting experience or game that involves a character. In this video
I'll try to cover almost all of those things: from the 3D side, modeling, skinning
or animation, to the programming side, writing the code nécessary to run the demo.

OK Disclaimer! I'll not be very thorough, but will jump from one task to the
next one quickly, giving general information and specific hints on each step,
randomly. There is no point into explaining each task into detail, specially
on the Blender side, since there are plenty of tutorials out there already.

First of all, I will show you the demo quickly, which is our goal.
The website is in the description.
You can move the character using W A S D or cursor keys, and jump
with the space bar or the mouse left button. Also, you can play it using your
VR headset, opening the url in a web browser like Firefox Reality or Oculus Browser,
and using the controllers to move the character.

As you can see, we have to make different things. The character and its
animations, the stars, and the ground and the background environment. We will have
to build everything in a 3d software, export it and import it in our website,
using javascript and a 3D Library.

The 3D program I normally use is Blender, but you could use any other like Maya,
Cinema 4D or 3D Max. The 3D library we will use is ThreeJS, but yeah, you could use any other like A-Frame or BabylonJS or raw WebGL (although the code will be quite different, of course).

This is a kind of postmortem tutorial, because I'm making the tutorial after making the demo
and I'm redoing some stuff again. So that's why you may see some inconsístencies and differences between the tutorial and the actual demo.

Ok, Let's go for it!

## 01 SKETCH

This is Foxr. I made it some months ago. I started with some very rough sketches,
and once it got approved I made the final art in figma. These are some illustrations
I made for merchandising, banners, and whatever it's needed; and were made from a 2D-only
point of view.

So, before we model the character in 3D, we need a better blueprint of its volume
and shapes. Typically we use a couple of 2D sketches that show how it is the
character from the front and the side. You cannot make shapes or features that are impossible to make in 3D, so you have to be very aware of that.

Making horizóntal straight lines help you to align and match the features of the body.


## 02 MODELING
## 03 UVS
## 04 TEXTURE
## 05 SETUP
## 06 SKINNING
## 07 ANIMATION
## 08 PROJECT STRUCTURE
## 09 SCENE SETUP
## 10 MODEL LOADING
## 11 ANIMATION LOADING
## 12 ENVIRONMENT
## 13 CONTROLS
## 14 PHYSICS
## 15 COLLISIONS
## 16 STARS
## 17 PARTICLES
