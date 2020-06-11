/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 */

var VRButton = {

	createButton: function ( renderer, callback ) {

		function showEnterVR( /*device*/ ) {

			var currentSession = null;

			function onSessionStarted( session ) {

				session.addEventListener( 'end', onSessionEnded );

				renderer.xr.setSession( session );
				button.textContent = 'EXIT VR';

				currentSession = session;

				callback('sessionStarted');
			}

			function onSessionEnded( /*event*/ ) {

				currentSession.removeEventListener( 'end', onSessionEnded );

				button.textContent = 'ENTER VR';

				currentSession = null;

				callback('sessionEnded');
			}

			//

			button.style.display = '';

			button.style.cursor = 'pointer';
			button.style.left = 'calc(50% - 70px)';
			button.style.width = '140px';

			button.textContent = 'ENTER VR';

			button.onmouseenter = function () {

				button.style.opacity = '1.0';
				button.style.background = 'rgba(255,255,255,0.4)';

			};

			button.onmouseleave = function () {

				button.style.opacity = '0.8';
				button.style.background = 'rgba(255,255,255,0.2)';

			};

			button.onclick = function () {

				if ( currentSession === null ) {

					// WebXR's requestReferenceSpace only works if the corresponding feature
					// was requested at session creation time. For simplicity, just ask for
					// the interesting ones as optional features, but be aware that the
					// requestReferenceSpace call will fail if it turns out to be unavailable.
					// ('local' is always available for immersive sessions and doesn't need to
					// be requested separately.)

					var sessionInit = { optionalFeatures: [ 'local-floor', 'bounded-floor' ] };
					navigator.xr.requestSession( 'immersive-vr', sessionInit ).then( onSessionStarted );

				} else {

					currentSession.end();

				}

			};

		}

		function disableButton() {

			button.style.display = '';

			button.style.cursor = 'auto';
			button.style.left = 'calc(50% - 75px)';
			button.style.width = '240px';

			button.onmouseenter = null;
			button.onmouseleave = null;

			button.onclick = null;

		}

		function showWebXRNotFound() {

			disableButton();

			button.textContent = 'VR NOT SUPPORTED';

		}

		function stylizeElement( element ) {

			element.style.position = 'absolute';
			element.style.bottom = '20px';
			element.style.padding = '16px 8px';
			element.style.border = '1px solid #000';
			element.style.borderRadius = '8px';
			element.style.background = 'rgba(255,255,255,0.2)';
			element.style.color = '#000';
			element.style.font = 'normal 16px sans-serif';
			element.style.textAlign = 'center';
			element.style.opacity = '0.8';
			element.style.outline = 'none';
			element.style.zIndex = '999';

		}

		if ( 'xr' in navigator ) {

			var button = document.createElement( 'button' );
			button.style.display = 'none';

			stylizeElement( button );

			navigator.xr.isSessionSupported( 'immersive-vr' ).then( function ( supported ) {

				supported ? showEnterVR() : showWebXRNotFound();

			} );

			return button;

		} else {

			var message = document.createElement( 'a' );

			if ( window.isSecureContext === false ) {

				message.href = document.location.href.replace( /^http:/, 'https:' );
				message.innerHTML = 'WEBXR NEEDS HTTPS'; // TODO Improve message

			} else {

				message.href = 'https://immersiveweb.dev/';
				message.innerHTML = 'WEBXR NOT AVAILABLE';

			}

			message.style.left = 'calc(50% - 120px)';
			message.style.width = '240px';
			message.style.textDecoration = 'none';

			stylizeElement( message );

			return message;

		}

	}

};

export { VRButton };
