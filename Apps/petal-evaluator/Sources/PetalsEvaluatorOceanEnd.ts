import PetalsEvaluator from "./PetalsEvaluator";
import type GameClient from "./GameClient";

import { toRarityIndex } from "./GameTypes";

export default class PetalsEvaluatorOceanEnd extends PetalsEvaluator {

	override name = "ocean_end";

	public constructor(gameClient: GameClient) {
		super(gameClient);

		this.dpsCalculatorManifest.targetMOBSID = "crab";
		this.dpsCalculatorManifest.targetMOBRarity = toRarityIndex("ultra");
		this.dpsCalculatorManifest.maxLigntningBounces = 4;

		this.scoreOverrider["wax"] = (rarity) => {
			return -10 * Math.pow(3, rarity - 6); 
		};
	}

}