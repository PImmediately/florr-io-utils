import PetalsEvaluator from "./PetalsEvaluator";
import type GameClient from "./GameClient";

import { toRarityIndex } from "./GameTypes";

export default class PetalsEvaluatorNormalAntHell extends PetalsEvaluator {

	override name = "normal_ant_hell";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.dpsCalculatorManifest.targetMOBSID = "ant_soldier";
		this.dpsCalculatorManifest.targetMOBRarity = toRarityIndex("ultra");
		this.dpsCalculatorManifest.maxLigntningBounces = 6;

		this.scoreMultiplier["bone"] = 1.5; // it can multihit, so with lots of mobs around, it always hits
	}

}