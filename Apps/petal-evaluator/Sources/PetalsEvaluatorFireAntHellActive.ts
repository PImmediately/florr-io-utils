import PetalsEvaluator from "./PetalsEvaluator";
import type GameClient from "./GameClient";

import { toRarityIndex } from "./GameTypes";

export default class PetalEvaluatorManifestFireAntHellActive extends PetalsEvaluator {

	override name = "fire_ant_hell_active";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.dpsCalculatorManifest.targetMOBSID = "fire_ant_soldier";
		this.dpsCalculatorManifest.targetMOBRarity = toRarityIndex("ultra");
		this.dpsCalculatorManifest.maxLigntningBounces = 6;

		this.scoreFactor["beetle_egg"] = 2;
		this.scoreFactor["web"] = 10;
		this.scoreFactor["jelly"] = 6;
		this.scoreFactor["ant_egg"] = 2;
		this.scoreFactor["moon"] = 9;
	}

}