import type GameClient from "./../GameClient";
import PetalEvaluator from "./PetalEvaluator";

import { toRarityIndex } from "./../GameTypes";

export default class PetalEvaluatorNormalAntHell extends PetalEvaluator {

	override name = "normal_ant_hell";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.options.state.area.hasManyMOBs = true;

		this.options.mob.id = this.gameClient.mobSIDToID("ant_soldier");
		this.options.mob.rarity = toRarityIndex("ultra");
	}

}