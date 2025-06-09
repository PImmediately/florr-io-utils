import type GameClient from "./../GameClient";
import { type PetalEvaluatorEvaluation } from "./PetalEvaluator";

import { toRarityIndex, toRaritySID, findTranslation } from "./../GameTypes";

export default class PetalEvaluationIndicator {

	public constructor(public readonly gameClient: GameClient, public readonly evaluations: PetalEvaluatorEvaluation[]) {
	}

	public toMarkdown() {
		const evaluations = this.evaluations.filter((evaluation) => {
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
		});

		const header = `# Evaluation\n- [Base Evaluation](#base-evaluation)\n- [Additional Evaluation](#additional-evaluation)\n`;

		let baseEvaluationText = `## Base Evaluation\n|Petal|Rarity|Note|Score|DPS|DPS (Total)|\n|:-:|:-:|:-:|:-:|:-:|:-:\n`;
		baseEvaluationText += evaluations
			.sort((a, b) => {
				if (a.calculator.simulator.options.petal.petal.sid !== b.calculator.simulator.options.petal.petal.sid) {
					return a.calculator.simulator.options.petal.petal.sid > b.calculator.simulator.options.petal.petal.sid ? 1 : -1;
				}
				if (a.calculator.simulator.options.petal.rarity !== b.calculator.simulator.options.petal.rarity) {
					return a.calculator.simulator.options.petal.rarity > b.calculator.simulator.options.petal.rarity ? 1 : -1;
				}
				return 0;
			})
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