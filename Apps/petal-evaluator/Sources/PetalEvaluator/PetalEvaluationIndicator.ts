import type GameClient from "./../GameClient";
import PetalEvaluator from "./PetalEvaluator";

import { toRarityIndex, toRaritySID, findTranslation, type RaritySID } from "./../GameTypes";

export interface RawPetalEvaluations {
	name: string;
	evaluations: (RawPetalBaseEvaluation | RawPetalAdditionalEvaluation)[];
}

export type RawPetalEvaluation = RawPetalBaseEvaluation | RawPetalAdditionalEvaluation;

export interface RawPetalBaseEvaluation {
	type: "base";
	sid: string;
	rarities: RawPetalBaseEvaluationRarity[];
}

export interface RawPetalBaseEvaluationRarity {
	rarity: RaritySID;
	score: number;
	damagePerSecondOnOneMOB: number;
	damagePerSecondOnArea: number;
	withPetals?: RawPetalBaseEvaluationRarityWithPetal[];
}

export interface RawPetalBaseEvaluationRarityWithPetal {
	sid: string;
	rarity: RaritySID | null;
}

export interface RawPetalAdditionalEvaluation {
	type: "additional";
	sid: string;
	amount: number;
	targetPetals: string[];
	rarities: RawPetalAdditionalEvaluationRarity[];
}

export interface RawPetalAdditionalEvaluationRarity {
	rarity: RaritySID;
	multiplier?: number;
}

export default class PetalEvaluationIndicator {

	public readonly evaluations;

	public constructor(public readonly gameClient: GameClient, public readonly evaluator: PetalEvaluator) {
		this.evaluations = evaluator.evaluate();
	}

	private getEvaluations() {
		return this.evaluations
			.filter((evaluation) => {
				const petal = this.gameClient.florrio.utils.getPetals().find((petal) => (petal.id === evaluation.calculator.simulator.options.petal.petal.id))!;
				if ((petal.magicPetal) && (!["magic_stick"].includes(petal.sid))) return false;

				// unique
				if (["mjolnir", "crown"].includes(evaluation.calculator.simulator.options.petal.petal.sid)) {
					return (evaluation.calculator.simulator.options.petal.rarity >= toRarityIndex("unique"));
				}
				if (
					(toRaritySID(evaluation.calculator.simulator.options.petal.rarity) === "unique") &&
					(["starfish"/*xayo*/, "bone"].includes(evaluation.calculator.simulator.options.petal.petal.sid))
				) {
					return true;
				}

				// ultra
				if (
					(toRaritySID(evaluation.calculator.simulator.options.petal.rarity) === "ultra") &&
					(["lightning", "stick", "moon", "wax", "magic_stick"].includes(evaluation.calculator.simulator.options.petal.petal.sid))
				) {
					return true;
				}

				// super
				if (evaluation.calculator.simulator.options.petal.rarity !== toRarityIndex("super")) {
					return false;
				}

				// for clover
				if (
					(typeof evaluation.calculator.simulator.options.userdata?.cloverRarity === "number") &&
					(
						(evaluation.calculator.simulator.options.userdata?.cloverRarity < toRarityIndex("ultra")) ||
						(evaluation.calculator.simulator.options.userdata?.cloverRarity > toRarityIndex("super"))
					)
				) {
					return false;
				}

				return true;
			})
			.sort((a, b) => {
				if (a.calculator.simulator.options.petal.petal.sid !== b.calculator.simulator.options.petal.petal.sid) {
					return a.calculator.simulator.options.petal.petal.sid > b.calculator.simulator.options.petal.petal.sid ? 1 : -1;
				}
				if (a.calculator.simulator.options.petal.rarity !== b.calculator.simulator.options.petal.rarity) {
					return a.calculator.simulator.options.petal.rarity > b.calculator.simulator.options.petal.rarity ? 1 : -1;
				}
				return 0;
			})
	}

	public toJSON() {
		const e: RawPetalEvaluations = {
			name: this.evaluator.name || "unnamed",
			evaluations: []
		};

		{
			const evaluations = this.getEvaluations();
			const baseEvaluationsEachPetal: Record<string, RawPetalBaseEvaluationRarity[]> = {};
			evaluations.forEach((evaluation) => {
				const petalSID = evaluation.calculator.simulator.options.petal.petal.sid;
				if (!baseEvaluationsEachPetal[petalSID]) {
					baseEvaluationsEachPetal[petalSID] = [];
				}

				const rarity: RawPetalBaseEvaluationRarity = {
					rarity: toRaritySID(evaluation.calculator.simulator.options.petal.rarity),
					score: evaluation.evaluation.score,
					damagePerSecondOnOneMOB: evaluation.evaluation.damagePerSecondOnOneMOB,
					damagePerSecondOnArea: evaluation.evaluation.damagePerSecondOnArea
				};

				if (typeof evaluation.calculator.simulator.options.userdata?.cloverRarity === "number") {
					if (!rarity.withPetals) rarity.withPetals = [];
					rarity.withPetals.push({
						sid: "clover",
						rarity: toRaritySID(evaluation.calculator.simulator.options.userdata.cloverRarity)
					});
				}

				if (
					(typeof evaluation.calculator.simulator.options.flower.hasThirdEye === "boolean") &&
					(evaluation.calculator.simulator.options.flower.hasThirdEye)
				) {
					if (!rarity.withPetals) rarity.withPetals = [];
					rarity.withPetals.push({
						sid: "third_eye",
						rarity: null
					});
				}

				if (typeof evaluation.calculator.simulator.options.userdata?.ultraMagicLeafCount === "number") {
					if (!rarity.withPetals) rarity.withPetals = [];
					for (let n = 0; n < evaluation.calculator.simulator.options.userdata.ultraMagicLeafCount; n++) {
						rarity.withPetals.push({
							sid: "magic_leaf",
							rarity: "ultra"
						});
					}
				}

				baseEvaluationsEachPetal[petalSID].push(rarity);
			});

			for (const petalSID in baseEvaluationsEachPetal) {
				e.evaluations.push({
					type: "base",
					sid: petalSID,
					rarities: baseEvaluationsEachPetal[petalSID]!
				});
			}
		}

		{
			const multipliedPetalSIDs = ["beetle_egg", "ant_egg", "moon", "wax"];

			for (let n = 1; n <= 9; n++) {
				const rarities = new Array<RawPetalAdditionalEvaluationRarity>();
				for (let rarity = toRarityIndex("ultra"); rarity <= toRarityIndex("ultra"); rarity++) {
					const goldenLeafReloadPerc = (() => {
						const petalGoldenLeaf = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === "golden_leaf")!;
						const _ = petalGoldenLeaf.rarities[rarity]!;
						return (findTranslation<[number]>(_.tooltip!, "Petal/Attribute/ReloadPerc") || [])[1] || 0;
					})();
					const multiplier = 1 / Math.pow(1 - goldenLeafReloadPerc, n);

					rarities.push({
						rarity: toRaritySID(rarity),
						multiplier
					});
				}

				e.evaluations.push({
					type: "additional",
					sid: "golden_leaf",
					amount: n,
					targetPetals: multipliedPetalSIDs,
					rarities
				});
			}
		}

		return e;
	}

	public toMarkdown() {
		const evaluations = this.getEvaluations();

		const header = `# Evaluation\n- [Base Evaluation](#base-evaluation)\n- [Additional Evaluation](#additional-evaluation)\n`;

		let baseEvaluationText = `## Base Evaluation\n|Petal|Rarity|Note|Score|DPS|DPS (Total)|\n|:-:|:-:|:-:|:-:|:-:|:-:\n`;
		baseEvaluationText += evaluations
			.map((evaluation) => {
				let note = "";
				if (evaluation.calculator.simulator.options.flower.hasThirdEye) note = `with \`third_eye\``;
				if (typeof evaluation.calculator.simulator.options.userdata?.cloverRarity === "number") note = `with \`${toRaritySID(evaluation.calculator.simulator.options.userdata?.cloverRarity)}\` \`clover\``;
				if (typeof evaluation.calculator.simulator.options.userdata?.ultraMagicLeafCount === "number") note = `with ${evaluation.calculator.simulator.options.userdata?.ultraMagicLeafCount}x \`ultra\` \`magic_leaf\``;

				return (
					"|" + "`" + evaluation.calculator.simulator.options.petal.petal.sid + "`" +
					"|" + "`" + toRaritySID(evaluation.calculator.simulator.options.petal.rarity) + "`" +
					"|" + note +
					"|" + evaluation.evaluation.score.toFixed(1) +
					"|" + Math.round(evaluation.evaluation.damagePerSecondOnOneMOB) +
					"|" + ((evaluation.evaluation.damagePerSecondOnOneMOB !== evaluation.evaluation.damagePerSecondOnArea) ? Math.round(evaluation.evaluation.damagePerSecondOnArea) : "-") +
					"|"
				);
			}).join("\n");
		baseEvaluationText += "\n";

		const multipliedPetalSIDs = ["beetle_egg", "ant_egg", "moon", "wax"];
		const ultraGoldenLeafReloadPerc = (() => {
			const petalGoldenLeaf = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === "golden_leaf")!;
			const _ = petalGoldenLeaf.rarities[toRarityIndex("ultra")]!;
			return (findTranslation<[number]>(_.tooltip!, "Petal/Attribute/ReloadPerc") || [])[1] || 0;
		})();

		let additionalEvaluationText = `## Additional Evaluation\n`;
		additionalEvaluationText += `The scores of petals such as ${((_) => {
			return _.length > 1 ? `${_.slice(0, -1).join(", ")} and ${_.slice(-1)}` : _[0] || ""
		})(multipliedPetalSIDs.map((_) => `\`${_}\``))} are multiplied according to the table below.\n`;
		additionalEvaluationText += `|Petal|Multiplier|\n|:-:|:-:|\n`;
		for (let n = 1; n <= 9; n++) {
			const multiplier = 1 / Math.pow(1 - ultraGoldenLeafReloadPerc, n);
			additionalEvaluationText += `|${n}x \`ultra\` \`golden_leaf\`|${multiplier.toFixed(1)}x|\n`;
		}

		return `${header}\n${baseEvaluationText}\n${additionalEvaluationText}`;
	}

}