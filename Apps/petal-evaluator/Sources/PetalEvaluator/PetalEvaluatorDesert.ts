import type GameClient from "./../GameClient";
import PetalEvaluator from "./PetalEvaluator";

import { toRarityIndex } from "./../GameTypes";

export default class PetalEvaluatorDesert extends PetalEvaluator {

	override name = "desert";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.options.mob.id = this.gameClient.mobSIDToID("beetle");
		this.options.mob.rarity = toRarityIndex("ultra");
	}

}