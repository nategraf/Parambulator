var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000 );
controls = new THREE.OrbitControls(camera);
//controls.target.set(0, 0, 0);
controls.update();
controls.autoRotate = true;
controls.autoRotateSpeed = Math.sin(Math.random() * 4)
//controls.minDistance = 10
controls.maxDistance = 20

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

group = new THREE.Group();
scene.add(group);

//SPHERE
//var sphereLoader = new THREE.TextureLoader();
/*sphereLoader.load("../earth_big.jpg", function (texture) {
	var geometry = new THREE.SphereGeometry(0.5,32,32);
	var material = new THREE.MeshBasicMaterial( { map: texture, overdraw: 0.5 } );
	var mesh = new THREE.Mesh(geometry, material);
	group.add(mesh);
});*/

/*var canvas = document.createElement( 'canvas' );
	canvas.width = 128;
	canvas.height = 128;*/

//var texture = new THREE.CanvasTexture( canvas );
var sphereGeometry = new THREE.SphereGeometry(0.5,32,32);
var sphereMaterial = new THREE.MeshBasicMaterial( {color: 0x00ff00 } );
var sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
var sphereEdges = new THREE.EdgesHelper(sphere, 0xffff00 );
//var sphereTexture = new THREE.TextureLoader().load("earth_big.jpg");
//sphereTexture.wrapS = THREE.RepeatWrapping;
//sphereTexture.wrapT = THREE.RepeatWrapping;
//sphereTexture.repeat.set(4,4);
sphere.rotation.x = 5;
sphere.position.x = 2;
scene.add( sphere );
scene.add( sphereEdges );
//scene.add( sphereTexture );

//CYLINDER
var cylGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1);
var cylMaterial = new THREE.MeshBasicMaterial( {color: 0x00ff00 });
var cylMesh = new THREE.Mesh(cylGeometry, cylMaterial);
var cylEdges = new THREE.EdgesHelper(cylMesh, 0xffff00);
scene.add(cylMesh);
scene.add(cylEdges);


camera.position.z = 2;
camera.position.y = 0;
camera.position.x = 0;

var render = function () {
	requestAnimationFrame( render );

	sphere.rotation.y += 0.01;
	sphere.rotation.y += 0.01;
	sphere.rotation.z -= 0.01;

	renderer.render(scene, camera);
};

render();
