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
	dependencePetals: string[];
	rarities: RawPetalAdditionalEvaluationRarity[];
}

export interface RawPetalAdditionalEvaluationRarity {
	rarity: RaritySID;
	scoreMultiplier: number;
}

export const MULTIPLIED_EVALUATION_PETALS_WITH_GOLDEN_LEAF = ["beetle_egg", "ant_egg", "moon", "wax"];

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
				if (typeof evaluation.calculator.simulator.options.userdata?.superMagicLeafCount === "number") {
					if (!rarity.withPetals) rarity.withPetals = [];
					for (let n = 0; n < evaluation.calculator.simulator.options.userdata.superMagicLeafCount; n++) {
						rarity.withPetals.push({
							sid: "magic_leaf",
							rarity: "super"
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
						scoreMultiplier: multiplier
					});
				}

				e.evaluations.push({
					type: "additional",
					sid: "golden_leaf",
					amount: n,
					dependencePetals: MULTIPLIED_EVALUATION_PETALS_WITH_GOLDEN_LEAF,
					rarities
				});
			}
		}

		return e;
	}

	public toMarkdown(cachedJSON?: RawPetalEvaluations) {
		let json: RawPetalEvaluations;
		if (!cachedJSON) {
			json = this.toJSON();
		} else {
			json = cachedJSON;
		}

		const header = `# Evaluation\n- [Base Evaluation](#base-evaluation)\n- [Additional Evaluation](#additional-evaluation)\n`;

		let baseEvaluationText = `## Base Evaluation\n|Petal|Rarity|Note|Score|DPS|DPS (Total)|\n|:-:|:-:|:-:|:-:|:-:|:-:\n`;
		json.evaluations.forEach((evaluation) => {
			if (evaluation.type !== "base") return;
			evaluation.rarities.forEach((rarity) => {
				let note = "";
				if (rarity.withPetals) {
					const petalCountsEachPetal: Record<string, Record<RaritySID | "none", number>> = {};
					rarity.withPetals.forEach((petal) => {
						if (!petalCountsEachPetal[petal.sid]) {
							const counts = {} as Record<RaritySID | "none", number>;
							for (let rarity = toRarityIndex("common"); rarity <= toRarityIndex("unique"); rarity++) {
								counts[toRaritySID(rarity)] = 0;
							}
							counts!["none"]! = 0;
							petalCountsEachPetal[petal.sid] = counts;
						}
						if (typeof petal.rarity === "string") {
							petalCountsEachPetal[petal.sid]![petal.rarity]! += 1;
						} else {
							petalCountsEachPetal[petal.sid]!["none"]! += 1;
						}
					});

					note = Object.entries(petalCountsEachPetal)
						.map(([petalSID, counts]) => {
							const countsText = Object.entries(counts)
								.map(([raritySID, count]) => {
									if (count <= 0) return "";
									if (raritySID === "none") return `${count}x \`${petalSID}\``;
									return `${count}x \`${raritySID}\` \`${petalSID}\``;
								})
								.filter((_) => _)
								.join(", ");
							return `with ${countsText}`;
						})
						.filter((_) => _)
						.join(", ");
				}

				baseEvaluationText += (
					"|" + "`" + evaluation.sid + "`" +
					"|" + "`" + rarity.rarity + "`" +
					"|" + note +
					"|" + rarity.score.toFixed(1) +
					"|" + Math.round(rarity.damagePerSecondOnOneMOB) +
					"|" + ((rarity.damagePerSecondOnOneMOB !== rarity.damagePerSecondOnArea) ? Math.round(rarity.damagePerSecondOnArea) : "-") +
					"|" +
					"\n"
				);
			});
		});

		let additionalEvaluationText = `## Additional Evaluation\n`;
		{
			additionalEvaluationText += `The scores of petals such as `;
			additionalEvaluationText += ((_) => {
				return _.length > 1 ? `${_.slice(0, -1).join(", ")} and ${_.slice(-1)}` : _[0] || ""
			})(MULTIPLIED_EVALUATION_PETALS_WITH_GOLDEN_LEAF.map((_) => `\`${_}\``));
			additionalEvaluationText += ` are multiplied according to the table below.\n`;
		}
		additionalEvaluationText += `|Petal|Multiplier|\n|:-:|:-:|\n`;
		json.evaluations.forEach((evaluation) => {
			if (evaluation.type !== "additional") return;
			evaluation.rarities.forEach((rarity) => {
				additionalEvaluationText += (
					"|" + evaluation.amount + "x" + " " + "`" + rarity.rarity + "`" + " " + "`" + evaluation.sid + "`" +
					"|" + rarity.scoreMultiplier.toFixed(1) + "x" +
					"|" +
					"\n"
				);
			});
		});

		return `${header}\n${baseEvaluationText}\n${additionalEvaluationText}`;
	}

}