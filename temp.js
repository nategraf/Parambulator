function initCannon() {
	var initCannon = this;
	this.addScene = addScene;
	this.restartCurrentScene = restartCurrentScene;
	this.changeScene = changeScene;
	this.start = start;
	var bodies = [];
	world = new CANNON.World();
	world.broadphase = new CANNON.NaiveBroadphase();
}
