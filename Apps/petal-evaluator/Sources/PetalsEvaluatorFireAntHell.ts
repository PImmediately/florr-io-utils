import PetalsEvaluator from "./PetalsEvaluator";
import type GameClient from "./GameClient";

import { toRarityIndex } from "./GameTypes";

export default class PetalsEvaluatorFireAntHell extends PetalsEvaluator {

	override name = "fire_ant_hell";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.dpsCalculatorManifest.targetMOBSID = "fire_ant_soldier";
		this.dpsCalculatorManifest.targetMOBRarity = toRarityIndex("ultra");
		this.dpsCalculatorManifest.maxLigntningBounces = 6;

		this.scoreMultiplier["web"] = 10;
		this.scoreMultiplier["jelly"] = 6;
		this.scoreMultiplier["moon"] = 7.5;
	}

}