import PetalsEvaluator from "./PetalsEvaluator";
import type GameClient from "./GameClient";

import { toRarityIndex } from "./GameTypes";

export default class PetalsEvaluatorNormalAntHell extends PetalsEvaluator {

	override name = "normal_ant_hell";
	override hasAreaTooManyMOBs = true;

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.dpsCalculatorManifest.targetMOBSID = "ant_soldier";
		this.dpsCalculatorManifest.targetMOBRarity = toRarityIndex("ultra");
		this.dpsCalculatorManifest.maxLigntningBounces = 4;
	}

}