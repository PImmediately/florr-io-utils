import type GameClient from "./../GameClient";
import PetalEvaluator from "./PetalEvaluator";

import { toRarityIndex } from "./../GameTypes";

export default class PetalEvaluatorOcean extends PetalEvaluator {

	override name = "ocean_end";
	
	public constructor(gameClient: GameClient) {
		super(gameClient);


		this.options.mob.id = this.gameClient.mobSIDToID("crab");
		this.options.mob.rarity = toRarityIndex("ultra");

		this.options.scoreMultiplier[this.gameClient.petalSIDToID("jelly")] = 1.5;
		this.options.scoreMultiplier[this.gameClient.petalSIDToID("moon")] = 10.5;

		this.options.scoreOverrider[this.gameClient.petalSIDToID("wax")] = (rarity) => {
			return -10 * Math.pow(3, rarity - 6); 
		};
	}

}