/**
       * A demo showing how to use the preStep callback to add a force to a body.
       * This will act like a force field.
       */


/*
* danger = red, take corrective measures
* too far away = yellow
* need to correct velocity vector = green, use thrusters
*/

const VISUALIZEPROJECTIONS = false;
const ZEROVEC = new CANNON.Vec3(0, 0, 0);
const XUNITVEC = new CANNON.Vec3(1, 0, 0);
const YUNITVEC = new CANNON.Vec3(0, 1, 0);
const ZUNITVEC = new CANNON.Vec3(0, 0, 1);
const PREDICTIONTIME = 3;
const MINPREDICTIONSTEP = 0.25;
const GM = 1200;
const M1 = GM / orb.constants.common.G;
const AVOIDANCETHRUST = 40;
const FOLLOWTHRUST = 10;
const CORRECTIONTHRUST = 10;
const IZZYTHRUST = 50;
const CORRECTIONTHRESHOLD = 3;
const INNERENVELOPE = 7;
const OUTERENVELOPE = 17;
const PERSONALSPACEFACTOR = 5;
var spawnArkletsOnce = true;
var bolides = [];
var arklets = [];

var key_space = false;
var key_b = false;
var key_up = false;
var key_down = false;
var key_left = false;
var key_right = false;

/* these two lines are testing */
var ArkletsPerLayer = 9;	/* must be a perfect square */
var sqrtAPL = Math.sqrt(ArkletsPerLayer);

var demo = new CANNON.Demo();

function addArkletCollisionBehavior(body, world) {
    body.addEventListener("collide", function (e) {
        demo.removeVisual(this);
        world.remove(this);
        console.log("ARKLET COLLISION!!!");
    });
}

function addBolideCollisionBehavior(body, world) {
    body.addEventListener("collide", function (e) {
        if (e.contact.bi.isPlanet || e.contact.bj.isPlanet) {
            console.log("planet collision");
            demo.removeVisual(this);
            world.remove(this);
        } else {
            body.needsOrbitalUpdate = true;
        }
        console.log("bolide collision");
    });
}

function addTimeStepPathPrediction(body, world, intelligent) {
    let orbitElems = [];
    if (body.orbitElems) {
        orbitElems = body.orbitElems;
    } else {
        let x = body.position.toArray();
        let xDot = body.velocity.toArray();
        orbitElems = orb.position.stateToKepler(x, xDot, 0, M1);
    }
    /* WARNING: Only works for spherical bodies */
    let projectionShape = new CANNON.Sphere(body.shapes[0].radius);
    projectionShape.collisionResponse = false;
    for (let i = 1; i <= PREDICTIONTIME / MINPREDICTIONSTEP ; i++) {
        let t = i * MINPREDICTIONSTEP;
        let projection = new CANNON.Body({
            mass: 1,
            collisionFilterGroup: 1 << i,
            collisionFilterMask: 1 << i
        });
        projection.addShape(projectionShape);

        world.addEventListener("postStep", function () {
            if (world.bodies.indexOf(body) != -1) {
                /* T0 (perihelion passage/epoch) may be NaN, which means the object has key_left orbit */
                orbitElems = body.orbitElems;
                if (Number.isNaN(orbitElems[6])) {
                    /* Hyperbolic orbit prediction, approximated by linear projection (Which is mostly good enough) */
                    projection.velocity.copy(body.velocity);
                    body.position.vadd(body.velocity.scale(t), projection.position);
                } else {
                    // Normal stable orbit prediction, using keplars equations provided by orb.js
                    orbitElems[5] = world.dt * world.stepnumber + t;
                    let cart = orb.position.keplerian(...orbitElems);
                    projection.position = new CANNON.Vec3(...cart[0]);
                    projection.velocity = new CANNON.Vec3(...cart[1]);
                }
            } else {
                // If the body no longer exists, delete the projection
                if (VISUALIZEPROJECTIONS) demo.removeVisual(projection);
                world.removeBody(projection);
                // TODO This causes a minor error in javascript. Figure out how to fix it
            }
        });
        if (intelligent) addCollisionAvoidance(body, projection, world);
        if (intelligent) addPersonalSpace(body, world);
        world.addBody(projection);
        if (VISUALIZEPROJECTIONS) demo.addVisual(projection);
    }
}

function addCollisionAvoidance(avoider, projection, world) {
    projection.addEventListener("collide", function (e) {
        if (!avoider.maneuvering) { // Dont add additioal force if the avoider is already thrusting, but the game is lagging
            let direction = new CANNON.Vec3();
            if (projection === e.contact.bi) { // Check to see if this projection is bi or bj in the collision
                e.contact.ri.negate().unit(direction);
            } else {
                e.contact.rj.negate().unit(direction);
            }
            let thrust = direction.scale(AVOIDANCETHRUST);
            avoider.force.vadd(thrust, avoider.force);
            avoider.needsOrbitalUpdate = true;
            createGlow(avoider, "DANGER");
            avoider.maneuvering = true;
        }
    });
}

function addPersonalSpace(body, world) {
    let bubbleShape = new CANNON.Sphere(body.shapes[0].radius * PERSONALSPACEFACTOR); // WARNING: Only works for spherical bodies
    bubbleShape.collisionResponse = false;
    let bubble = new CANNON.Body({
        mass: 1,
        collisionFilterGroup: 1 << 15,
        collisonFilterMask: 1 << 15
    });
    bubble.addShape(bubbleShape);
    world.addEventListener("postStep", function () {
        if (world.bodies.indexOf(body) != -1) {
            bubble.velocity.copy(body.velocity);
            bubble.position.copy(body.position);
        } else {
            // If the body no longer exists, delete the projection
            if (VISUALIZEPROJECTIONS) demo.removeVisual(bubble);
            world.removeBody(bubble);
            // TODO This causes a minor error in javascript. Figure out how to fix it
        }
    });

    bubble.addEventListener("collide", function (e) {
        if (!this.maneuvering) {
            let direction = new CANNON.Vec3();
            if (bubble === e.contact.bi) { // Check to see if this projection is bi or bj in the collision
                e.contact.ri.negate().unit(direction);
            } else {
                e.contact.rj.negate().unit(direction);
            }
            let thrust = direction.scale(AVOIDANCETHRUST);
            body.force.vadd(thrust, body.force);

            body.needsOrbitalUpdate = true;
            createGlow(body, "DANGER");
        }
    });

    world.addBody(bubble);
    if (VISUALIZEPROJECTIONS) demo.addVisual(bubble);
}

function LayerNum(i) {	//returns which layer an arklet should spawn in
    //influences z direction
    let num = Math.floor(i / ArkletsPerLayer);
    return num;
}

function LayerLine(i) {	//returns which line in a layer the arklet should spawn in
    //influences y direction
    let line = Math.ceil(((i - (ArkletsPerLayer * Math.floor(i / ArkletsPerLayer))) / sqrtAPL));
    if (LinePos(i) == 0) { line += 1; }
    return line;
}

function LinePos(i) {	//returns where in a line an arklet should spawn
    //influences x direction
    let spot = (((i - (ArkletsPerLayer * Math.floor(i / ArkletsPerLayer))) % sqrtAPL))
    return spot;
}

var spawnBolides = true;

function addForces() {
    let onwards = demo.getSpace();
    return onwards;
}

function generateArkletCloud(n, world) {
    let mass = 1;
    let arkletShape = new CANNON.Cylinder(0.2, 0.35, 0.4, 32);

    let x = izzy.x;
    let y = izzy.y;
    let z = izzy.z;	//still overwritten key_right away
    let vx = izzy.vx;		//but allow for different spawn conditions
    let vy = izzy.vy;
    let vz = izzy.vz;

    for (let i = 0; i < n; i++) {
        let x = izzy.position.x;
        let y = izzy.position.y;
        let z = izzy.position.z;

        let arklet = new CANNON.Body({
            mass: 1,
            //Notes: need to make if statement which decides which direction is 'behind'
            position: new CANNON.Vec3(x + INNERENVELOPE - sqrtAPL + (LayerLine(i)), y + INNERENVELOPE + (LayerNum(i)), z + INNERENVELOPE + (LinePos(i))),
            collisionFilterGroup: 1,
            collisonFilterMask: 1
        });
        arklet.orbitElems = [];
        arklet.needsOrbitalUpdate = true;
        arklet.addShape(arkletShape);
        arklet.velocity.copy(izzy.velocity);
        arklet.linearDamping = 0.0;

        arklet.preStep = function () {
            // Get the vector pointing from the moon to the planet center
            let arklet_to_planet = new CANNON.Vec3();
            this.position.negate(arklet_to_planet);
            // Get distance from planet to moon
            let distance = arklet_to_planet.length();
            // Now apply force on moon
            // Fore is pointing in the moon-planet direction
            arklet_to_planet.normalize();
            arklet_to_planet.scale((GM * mass) / Math.pow(distance, 2), arklet_to_planet);
            this.force.vadd(arklet_to_planet, this.force);
            //Add in forces acting on Arklet here

            // Izzy Following
            let FtoD = new CANNON.Vec3();
            this.position.vsub(izzy.position, FtoD);
            let modFollowForce = 0;

            /*
             * Need to find a force vector going in the direction which pushes the arklet in the direction
             * of izzy, and add this to the arklet using vadd
            */
            if (!this.velocity.almostEquals(izzy.velocity, CORRECTIONTHRESHOLD)) {
                let correctionalVector = new CANNON.Vec3();
                izzy.velocity.vsub(this.velocity, correctionalVector);
                correctionalVector.normalize();
                let correctionalThrust = correctionalVector.scale(CORRECTIONTHRUST);
                this.force.vadd(correctionalThrust, this.force);
                createGlow(this, "THRUST");
                this.needsOrbitalUpdate = true;
            }
            if (FtoD.length() < 5) {
                modFollowForce = -0.1 * (FtoD.length() - INNERENVELOPE);
                this.needsOrbitalUpdate = true;
            } //when too close to izzy
            if (FtoD.length() > 15) {
                modFollowForce = -0.1 * (FtoD.length() - OUTERENVELOPE);
                this.needsOrbitalUpdate = true;
            } //when too far from izzy
            FtoD.normalize();
            let thrust = FtoD.scale(FOLLOWTHRUST * modFollowForce);
            this.force.vadd(thrust, this.force);
            createGlow(this, "WARNING");
        }

        arklet.postStep = function () {
            this.force.setZero();
            if (this.maneuvering) {
                this.maneuvering = false;
            }

            if (this.needsOrbitalUpdate) {
                let x = this.position.toArray();
                let xDot = this.velocity.toArray();
                this.orbitElems = orb.position.stateToKepler(x, xDot, world.dt * world.stepnumber, M1); // Calculate the new orbital elements after a change in state
                let t0 = this.orbitElems[5];
                this.orbitElems.push(t0, 0, M1); // Append the reference elements of epoch, mean anomoly at epoch, and central mass
                this.needsOrbitalUpdate = false; // Set that this body no longer needs an update                   
            }
            createGlow(this, "NORMAL");
        }

        arklets.push(arklet);
    }
    return arklets;
}

function generateBolide(world) {
    let size = demo.getSize();
    let mass = 4 / 3.0 * Math.PI * Math.pow(size, 3);
    let shape = new CANNON.Sphere(size);
    let randomMult = demo.getRandomness();
    let a = demo.getA() + Math.random() * randomMult;
    let e = demo.getE() + Math.random() * randomMult / 5.0;
    let i = orb.common.deg2rad(demo.getI()) + Math.random() * randomMult;
    let O = orb.common.deg2rad(demo.getO()) + Math.random() * randomMult;
    let o = orb.common.deg2rad(demo.geto());
    let m0 = Math.PI * 2 * Math.random();
    let orbitElems = [a, e, i, O, o, world.dt * world.stepnumber, 0, m0, M1];
    let cartesian = orb.position.keplerian(...orbitElems);
    let bolide = new CANNON.Body({
        mass: mass,
        position: new CANNON.Vec3(...cartesian[0]),
        collisionFilterGroup: 1 | (1 << 15),
        collisionFilterMask: 1 | (1 << 15),
    });
    bolide.addShape(shape);

    // If this is the first time this code has been run, make new THREE mesh
    if (!bolideGeo) {
        var bolideGeo = new THREE.SphereGeometry(size, 32, 32);
        var bolideTexture = new THREE.TextureLoader().load("img/phobos2k.jpg");
        var bolideMaterial = new THREE.MeshPhongMaterial({
            map: bolideTexture
        });
        var bolideMesh = new THREE.Mesh(bolideGeo, bolideMaterial);
    }
    let bolide3D = new THREE.Object3D();
    bolide3D.add(bolideMesh);
    bolide3D.position = bolide.position;
    bolide3D.quaternion = bolide.quaternion;
    demo.bodies.push(bolide)
    demo.visuals.push(bolide3D);
    bolide.visualref = bolide3D;
    bolide.visualref.visualId = demo.bodies.length - 1;
    demo.scene.add(bolide3D);

    bolide.velocity.set(...cartesian[1]);
    bolide.linearDamping = 0.0;
    bolide.orbitElems = orbitElems; // Define our own member for storing the needed information
    bolide.preStep = function () {
        // Get the vector pointing from the moon to the planet center
        let bolide_to_planet = new CANNON.Vec3();
        this.position.negate(bolide_to_planet);
        // Get distance from planet to moon
        let distance = bolide_to_planet.length();
        // Now apply force on moon
        // Fore is pointing in the moon-planet direction
        bolide_to_planet.normalize();
        bolide_to_planet.scale((GM * mass) / Math.pow(distance, 2), bolide_to_planet);
        this.force.vadd(bolide_to_planet, this.force);
    };

    bolide.postStep = function () {
        this.force.setZero();

        if (this.needsOrbitalUpdate) {
            let x = this.position.toArray();
            let xDot = this.velocity.toArray();
            this.orbitElems = orb.position.stateToKepler(x, xDot, world.dt * world.stepnumber, M1); // Calculate the new orbital elements after a change in state
            let t0 = this.orbitElems[5];
            this.orbitElems.push(t0, 0, M1); // Append the reference elements of epoch, mean anomoly at epoch, and central mass
            this.needsOrbitalUpdate = false; // Set that this body no longer needs an update                   
        }
    }
    return bolide;
}

function generateIzzy(world) {
    let mass = 20;
    let izzyBodyShape = new CANNON.Cylinder(1, 1, 5, 10);
    let amaltheaShape = new CANNON.Sphere(2);
    let randomMult = 1;
    let a = demo.getA() + Math.random() * randomMult;
    let e = demo.getE() + Math.random() * randomMult / 5.0;
    let i = orb.common.deg2rad(demo.getI()) + Math.random() * randomMult;
    let O = orb.common.deg2rad(demo.getO()) + Math.random() * randomMult;
    let o = orb.common.deg2rad(demo.geto());
    let cartesian = orb.position.keplerian(a + 40, e, i, O, o, 0, 0, 0, M1);

    let izzy = new CANNON.Body({
        mass: mass,
        position: new CANNON.Vec3(...cartesian[0]),
        collisionFilterGroup: 1,
        collisonFilterMask: 1
    });

    izzy.velocity.set(...cartesian[1]);
    izzy.linearDamping = 0.0;
    addBolideCollisionBehavior(izzy, world);

    izzy.addShape(izzyBodyShape);
    izzy.addShape(amaltheaShape, new CANNON.Vec3(0, 0, 2.5));

    izzy.preStep = function () {
        forward = demo.getSpace();
        // Get the vector pointing from the moon to the planet center
        let izzy_to_planet = new CANNON.Vec3();
        let temp = new CANNON.Vec3();
        this.position.negate(temp);
        temp.normalize();
        this.position.negate(izzy_to_planet);
        // Get distance from planet to izzy
        let distance = izzy_to_planet.length();
        // Now apply force on izzy
        // Fore is pointing in the moon-planet direction
        izzy_to_planet.normalize();
        izzy_to_planet.scale((GM * mass) / Math.pow(distance, 2), izzy_to_planet);
        this.force.vadd(izzy_to_planet, this.force);

        if (key_space == true) {
            let thrust = izzy.velocity.unit();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_space = false;
        }

        if (key_b == true) {
            let thrust = this.velocity.unit().negate();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_b = false;
        }

        if (key_left == true) {
            let thrust = this.velocity.cross(this.position).unit().negate();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_left = false;
        }

        if (key_right == true) {
            let thrust = this.velocity.cross(this.position).unit();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_right = false;
        }

        if (key_up == true) {
            let thrust = this.position.unit();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_up = false;
        }

        if (key_down == true) {
            let thrust = this.position.unit().negate();
            thrust.scale(IZZYTHRUST, thrust);
            this.force.vadd(thrust, this.force);
            key_down = false;
        }

    }

    izzy.postStep = function () {
        izzy.quaternion.setFromVectors(ZUNITVEC, izzy.velocity);
        this.force.setZero();
    }
    return izzy;
}

function createGlow(object, type) {
    if (object.visualref.isArklet) {
        switch (type) {
            case 'WARNING':
                //object.visualref.children[0].material.color.set("yellow");
                object.visualref.children[0].material = new THREE.MeshPhongMaterial({ color: "yellow" });
                object.visualref.children[0].material.needsUpdate = true;
                object.visualref.children[0].geometry.colorsNeedUpdate = true;
                object.visualref.children[0].geometry.elementsNeedUpdate = true;
                break;

            case 'DANGER':
                //object.visualref.children[0].material.color.set("red");
                object.visualref.children[0].material = new THREE.MeshPhongMaterial({ color: "red" });
                object.visualref.children[0].material.needsUpdate = true;
                object.visualref.children[0].geometry.colorsNeedUpdate = true;
                object.visualref.children[0].geometry.elementsNeedUpdate = true;
                break;

            case 'THRUST':
                //object.visualref.children[0].material.color.set("green");
                object.visualref.children[0].material = new THREE.MeshPhongMaterial({ color: "green" });
                object.visualref.children[0].material.needsUpdate = true;
                object.visualref.children[0].geometry.colorsNeedUpdate = true;
                object.visualref.children[0].geometry.elementsNeedUpdate = true;
                break;

            case 'NORMAL':
                //object.visualref.children[0].material.color.set("white");
                object.visualref.children[0].material = new THREE.MeshPhongMaterial({ color: "white" });
                object.visualref.children[0].material.needsUpdate = true;
                object.visualref.children[0].geometry.colorsNeedUpdate = true;
                object.visualref.children[0].geometry.elementsNeedUpdate = true;
                break;
        }
        object.visualref.children[0].material.needsUpdate = true;
        object.visualref.children[0].geometry.colorsNeedUpdate = true;
        object.visualref.children[0].geometry.elementsNeedUpdate = true;

    } else {
        console.log("ERROR: Arg[0] for createGlow() must be of" +
                " type THREE.Object3D.");
    }

}

var index = 0;
var izzy;

demo.addScene("Restart", function () {
    let world = demo.getWorld();

    index = 0;
    izzy = generateIzzy(world);

    //EARTH
    let earthShape = new CANNON.Sphere(30);
    let earthBody = new CANNON.Body({
        mass: 0,
        collisionFilterGroup: 0xFFFF, // Collide with all of the projections and bolides
        collisionFilterMask: 0xFFFF // Collide with all of the projections and bolides
    });
    earthBody.addShape(earthShape);
    earthBody.position.set(0, 0, 0);
    earthBody.quaternion.w = 1;
    //earthBody.angularVelocity = new CANNON.Vec3(10,10,10);
    earthBody.isPlanet = true;
    demo.bodies.push(earthBody);
    let earth = new THREE.SphereGeometry(30, 32, 32);
    let earthTexture = new THREE.TextureLoader().load("img/earth_big.jpg");
    let earthBump = new THREE.TextureLoader().load("img/earth_bump_big.jpg");
    let earthMaterial = new THREE.MeshPhongMaterial({
        map: earthTexture,
        bumpMap: earthBump
    });
    let earthMesh = new THREE.Mesh(earth, earthMaterial);
    let earth3d = new THREE.Object3D();
    earth3d.add(earthMesh);
    earth3d.position = earthBody.position;
    earth3d.quaternion = earthBody.quaternion;
    earthBody.isEarth = true;
    earthBody.visualref = earth3d;
    earthBody.visualref.visualId = demo.bodies.length - 1;
    demo.visuals.push(earth3d);
    demo.scene.add(earth3d);

    //EARTH CLOUD LAYER
    let cloudShape = new CANNON.Sphere(30.1);
    cloudShape.collisionResponse = false;
    let cloudBody = new CANNON.Body({
        mass: 0,
    });
    cloudBody.addShape(cloudShape);
    cloudBody.position.set(0, 0, 0);
    cloudBody.quaternion.w = 1;
    //cloudBody.quaternion.set(0.2, 0.7, 0);
    cloudBody.isPlanet = false;
    demo.bodies.push(cloudBody);
    let cloud = new THREE.SphereGeometry(30.4, 32, 32);
    let cloudTexture = new THREE.TextureLoader().load("img/cloud_combined_2048.jpg");
    let cloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        side: THREE.FrontSide,
        opacity: 0.5,
        transparent: true
    });
    let cloudMesh = new THREE.Mesh(cloud, cloudMaterial);
    let cloud3d = new THREE.Object3D();
    cloud3d.add(cloudMesh);
    cloud3d.position = cloudBody.position;
    cloud3d.quaternion = cloudBody.quaternion;
    cloudBody.visualref = cloud3d;
    cloudBody.visualref.visualId = demo.bodies.length - 1;
    cloudBody.isCloud = true;
    demo.visuals.push(cloud3d);
    demo.scene.add(cloud3d);

    //MERCURY
    var mercuryTexture = new THREE.TextureLoader().load("img/mercurymap.jpg");
    var mercuryBump = new THREE.TextureLoader().load("img/mercurybump.jpg");
    var mercuryMaterial = new THREE.MeshPhongMaterial({
        map: mercuryTexture,
        bumpMap: mercuryBump
    });
    var mercury = new THREE.SphereGeometry(5, 32, 32);
    var mercuryMesh = new THREE.Mesh(mercury, mercuryMaterial);
    var merc3d = new THREE.Object3D();
    merc3d.add(mercuryMesh);
    merc3d.position.set(-1000, 0, 100);
    demo.scene.add(merc3d);




    //VENUS
    var venus = new THREE.SphereGeometry(18, 32, 32);
    var venusTexture = new THREE.TextureLoader().load("img/venusmap.jpg");
    var venusBump = new THREE.TextureLoader().load("img/venusbump.jpg");
    var venusMaterial = new THREE.MeshPhongMaterial({
        map: venusTexture,
        bumpMap: venusBump
    });
    var venusMesh = new THREE.Mesh(venus, venusMaterial);
    var venus3d = new THREE.Object3D();
    venus3d.add(venusMesh);
    venus3d.position.set(-500, 0, -70);
    demo.scene.add(venus3d);



    //MARS
    var mars = new THREE.SphereGeometry(10, 32, 32);
    var marsTexture = new THREE.TextureLoader().load("img/mars_1k_color.jpg");
    var marsBump = new THREE.TextureLoader().load("img/marsbump1k.jpg");
    var marsMaterial = new THREE.MeshPhongMaterial({
        map: marsTexture,
        bumpMap: marsBump
    });
    var marsMesh = new THREE.Mesh(mars, marsMaterial);
    var mars3d = new THREE.Object3D();
    mars3d.add(marsMesh);
    mars3d.position.set(400, 0, -100);
    demo.scene.add(mars3d);



    //JUPITER
    var jupiter = new THREE.SphereGeometry(160, 32, 32);
    var jupiterTexture = new THREE.TextureLoader().load("img/jupiter2_1k.jpg");
    var jupiterMaterial = new THREE.MeshPhongMaterial({
        map: jupiterTexture
    });
    console.log('jupiter2');
    var jupiterMesh = new THREE.Mesh(jupiter, jupiterMaterial);
    var jupiter3d = new THREE.Object3D();
    jupiter3d.add(jupiterMesh);
    jupiter3d.position.set(900, 0, 500);
    demo.scene.add(jupiter3d);


    //SATURN
    var saturn = new THREE.SphereGeometry(130, 32, 32);
    var saturnTexture = new THREE.TextureLoader().load("img/saturnmap.jpg");
    var saturnMaterial = new THREE.MeshPhongMaterial({
        map: saturnTexture
    });
    var saturnMesh = new THREE.Mesh(saturn, saturnMaterial);
    var saturn3d = new THREE.Object3D();
    saturn3d.position.set(1500, 0, -150);
    saturn3d.add(saturnMesh);
    demo.scene.add(saturn3d);



    //SATURN RING
    var saturnRing = new THREE.RingGeometry(150, 230, 30, 30);
    var saturnRingTexture = new THREE.TextureLoader().load("img/saturnringcolor.jpg");
    var saturnRingMaterial = new THREE.MeshBasicMaterial({
        map: saturnRingTexture
    });
    var saturnRingMesh = new THREE.Mesh(saturnRing, saturnRingMaterial);
    var saturnRing3d = new THREE.Object3D();
    saturnRing3d.add(saturnRingMesh);
    saturnRing3d.position.set(1500, 0, -150);
    var euler = new THREE.Euler(0, 0, 1.57, 'XYZ');
    demo.scene.add(saturnRing3d);


    //URANUS
    var uranus = new THREE.SphereGeometry(70, 32, 32);
    var uranusTexture = new THREE.TextureLoader().load("img/uranusmap.jpg");
    var uranusMaterial = new THREE.MeshPhongMaterial({
        map: uranusTexture
    });
    var uranusMesh = new THREE.Mesh(uranus, uranusMaterial);
    var uranus3d = new THREE.Object3D();
    uranus3d.add(uranusMesh);
    uranus3d.position.set(1900, 0, -400);
    demo.scene.add(uranus3d);

    var uranusRing = new THREE.RingGeometry(72, 140, 30, 30);
    var uranusRingTexture = new THREE.TextureLoader().load("img/uranusringcolour.jpg");
    var uranusRingAlpha = new THREE.TextureLoader().load("img/uranusringtrans.gif");
    var uranusRingMaterial = new THREE.MeshBasicMaterial({
        map: uranusRingTexture,
    });
    var uranusRingMesh = new THREE.Mesh(uranusRing, uranusRingMaterial);
    var uranusRing3d = new THREE.Object3D();
    uranusRing3d.add(uranusRingMesh);
    uranusRing3d.position.set(1900, 0, -400);
    demo.scene.add(uranusRing3d);


    //NEPTUNE
    var neptune = new THREE.SphereGeometry(70, 32, 32);
    var neptuneTexture = new THREE.TextureLoader().load("img/neptunemap.jpg");
    var neptuneMaterial = new THREE.MeshPhongMaterial({
        map: neptuneTexture
    });
    var neptuneMesh = new THREE.Mesh(neptune, neptuneMaterial);
    var neptune3d = new THREE.Object3D();
    neptune3d.add(neptuneMesh);
    neptune3d.position.set(2200, 0, 700);
    demo.scene.add(neptune3d);


    //PLUTO
    var pluto = new THREE.SphereGeometry(10, 32, 32);
    var plutoTexture = new THREE.TextureLoader().load("img/plutomap1k.jpg");
    var plutoBump = new THREE.TextureLoader().load("img/plutobump1k.jpg");
    var plutoMaterial = new THREE.MeshPhongMaterial({
        map: plutoTexture,
        bumpMap: plutoBump
    });
    var plutoMesh = new THREE.Mesh(pluto, plutoMaterial);
    var pluto3d = new THREE.Object3D();
    pluto3d.add(plutoMesh);
    pluto3d.position.set(2500, 0, 400);
    demo.scene.add(pluto3d);


    var starmap = new THREE.SphereGeometry(4092, 32, 32);
    var starMaterial = new THREE.MeshBasicMaterial();
    starMaterial.map = new THREE.TextureLoader().load("img/milkywaypan_brunier_2048.jpeg");
    starMaterial.side = THREE.DoubleSide;
    starMaterial.transparent = true;
    var starMesh = new THREE.Mesh(starmap, starMaterial);
    var star3d = new THREE.Object3D();
    star3d.add(starMesh);
    if (starMesh && star3d) {
        demo.scene.add(star3d);
    } else {
        console.log("Couldn't create star map");
    }

    var sun = new THREE.SphereGeometry(800, 32, 32);
    var sunMaterial = new THREE.MeshBasicMaterial();
    sunMaterial.map = new THREE.TextureLoader().load("img/preview_sun.jpg");
    var sunMesh = new THREE.Mesh(sun, sunMaterial);
    var sun3d = new THREE.Object3D();
    sun3d.add(sunMesh);
    sun3d.position.set(-3100, 0, 0);
    demo.scene.add(sun3d);




    // Use the preStep callback to apply the gravity force on the moon.
    // This callback is evoked each timestep.
    world.addEventListener("preStep", function () {
        let numberOfArklets = demo.getNumberOfArklets();
        let spawnArklets = demo.getSpawnArklets();
        spawnBolides = demo.getSpawnBolides();
        let numberOfBolides = demo.getNumberOfBolides();
        let forward = demo.getSpace();
        let backward = demo.getB();
        let testAngular = demo.getLeft();
        let testAngularOpposite = demo.getRight();
        let getUp = demo.getUp();
        let getDown = demo.getDown();

        if (forward == true) {
            key_space = true;
            demo.setSpace();
        }

        if (backward == true) {
            key_b = true;
            demo.setB();
        }

        if (testAngular == true) {
            key_left = true;
            demo.setLeft();
        }

        if (testAngularOpposite == true) {
            key_right = true;
            demo.setRight();
        }

        if (getUp == true) {
            key_up = true;
            demo.setUp();
        }

        if (getDown == true) {
            key_down = true;
            demo.setDown();
        }

        if (spawnArklets && spawnArkletsOnce) {
            for (let i = 0; i < arklets.length; i++) {
                world.addBody(arklets[i]);
                //demo.addVisual(arklets[i]); 
                let arklet = new THREE.CylinderGeometry(0.2, 0.35, 0.4, 32, 32);
                let arkletMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
                let arklet3d = new THREE.Object3D();
                let arkletMesh = new THREE.Mesh(arklet, arkletMaterial);
                arklet3d.add(arkletMesh);
                arklet3d.isArklet = true;
                arklet3d.position = arklets[i].position;
                arklet3d.quaternion = arklets[i].quaternion;
                demo.bodies.push(arklets[i]);
                arklets[i].visualref = arklet3d;
                arklets[i].visualref.visualId = demo.bodies.length - 1;
                demo.visuals.push(arklet3d);

                addTimeStepPathPrediction(arklets[i], world, true); // Add the path projections!
                addArkletCollisionBehavior(arklets[i], world);


                demo.scene.add(arklet3d);
            }
            spawnArkletsOnce = false;
        }

        if (spawnBolides) {
            if (bolides.length < numberOfBolides) {
                let bolide = generateBolide(world);
                addTimeStepPathPrediction(bolide, world, false); // Add the path projections!
                addBolideCollisionBehavior(bolide, world);

                world.addBody(bolide);
                bolides.push(bolide);
            }
            else if (bolides.length > numberOfBolides) {
                // Delete some bolides
            }
        }
        index++;
    });

    world.addBody(izzy);
    demo.addVisual(izzy);
    world.addBody(earthBody);

});

demo.start();