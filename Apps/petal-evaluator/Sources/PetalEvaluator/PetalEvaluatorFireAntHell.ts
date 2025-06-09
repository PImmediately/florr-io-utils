import type GameClient from "./../GameClient";
import PetalEvaluator from "./PetalEvaluator";

import { toRarityIndex } from "./../GameTypes";

export default class PetalEvaluatorFireAntHell extends PetalEvaluator {

	override name = "fire_ant_hell";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.options.state.area.hasManyMOBs = true;

		this.options.mob.id = this.gameClient.mobSIDToID("fire_ant_soldier");
		this.options.mob.rarity = toRarityIndex("ultra");

		this.options.scoreMultiplier[this.gameClient.petalSIDToID("wing")] = 1.2;
		this.options.scoreMultiplier[this.gameClient.petalSIDToID("web")] = 10;
		this.options.scoreMultiplier[this.gameClient.petalSIDToID("jelly")] = 4.5;
		this.options.scoreMultiplier[this.gameClient.petalSIDToID("moon")] = 8.6;

		this.options.scoreOverrider[this.gameClient.petalSIDToID("wax")] = (rarity) => {
			return 0.7 * Math.pow(3, rarity - 6);
		};
	}

}