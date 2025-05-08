import PetalDPSCalculatorManifest from "./PetalDPSCalculatorManifest";
import type GameClient from "./GameClient";

import { findTranslation, toRarityIndex, toRaritySID } from "./GameTypes";
import PetalDPSCalculator, { type PetalDPSCalculatorOptionsState } from "./PetalDPSCalculator";

export interface PetalEvaluation {
	petal: {
		sid: string;
		rarity: number;
	};
	dps: number;
	score: number;
	actualScore: number;
	cloverRarity: number | undefined;
	ultraMagicLeafCount: number | undefined;
}

export default class PetalsEvaluator {

	public name: string | null = null;

	public dpsCalculatorManifest = new PetalDPSCalculatorManifest();

	public basePetalSID = "coin";
	public basePetalRarity = toRarityIndex("super");

	public scoreMultiplier: Record<string, number> = {
		"missile": 0.25, // projectile
		"grapes": 0.25, // projectile
		"pollen": 0.25, // projectile
		"magnet": 0,
		"pearl": 0.25, // projectile
		"peas": 0.25, // projectile
		"poo": 0,
		"bulb": 0,
		"carrot": 0.25, // projectile
		"plank": 0,
		"rubber": 0,
		"compass": 0,
		"mecha_missile": 0.25, // projectile
		"laser": 0.2, // cannot always be touched
	};
	public scoreOverrider: Record<string, (ratity: number) => number> = {};

	public constructor(public readonly gameClient: GameClient) {
	}

	public evaluate(): PetalEvaluation[] {
		const dpss = this.calcDPSOnAllPetals();
		const baseDPS = dpss.find((dps) => ((dps.petal.sid === this.basePetalSID) && (dps.petal.rarity === this.basePetalRarity)));
		if (!baseDPS) throw new Error("Base evaluation petal not found");

		return dpss.map((dps) => {
			const actualScore = dps.dps / baseDPS.dps;

			let score = actualScore * ((typeof this.scoreMultiplier[dps.petal.sid] === "number") ? this.scoreMultiplier[dps.petal.sid]! : 1);
			if (dps.petal.sid in this.scoreOverrider) {
				score = this.scoreOverrider[dps.petal.sid]!(dps.petal.rarity);
			}

			return {
				petal: dps.petal,
				dps: dps.dps,
				score,
				actualScore: actualScore,
				cloverRarity: dps.cloverRarity,
				ultraMagicLeafCount: dps.ultraMagicLeafCount,
			};
		});
	}

	private calcDPSOnAllPetals() {
		const mob = this.gameClient.florrio.utils.getMobs().find(mob => mob.sid === this.dpsCalculatorManifest.targetMOBSID);
		if (!mob) throw new Error("Target MOB not found");

		const dpss = new Array<{
			petal: {
				sid: string
				rarity: number;
			};
			dps: number;
			cloverRarity?: number;
			ultraMagicLeafCount?: number;
		}>();

		const dpsStateBaseOptions: PetalDPSCalculatorOptionsState = {
			flowerTalentDuplicator: this.dpsCalculatorManifest.flowerTalentDuplicator,
			flowerTalentReloadMultiplier: this.dpsCalculatorManifest.flowerTalentReloadMultiplier,
			flowerTalentSummonerMultiplier: this.dpsCalculatorManifest.flowerTalentSummonerMultiplier,
			flowerTalentPoisonMultiplier: this.dpsCalculatorManifest.flowerTalentSummonerMultiplier,

			flowerPetalRotation: this.dpsCalculatorManifest.flowerPetalRotation,
			flowerLuck: this.dpsCalculatorManifest.flowerBaseLuck,
			flowerManaPerSecond: this.dpsCalculatorManifest.flowerManaPerSecond,

			maxLigntningBounces: this.dpsCalculatorManifest.maxLigntningBounces,
			touchedLaserEntityCount: this.dpsCalculatorManifest.touchedLaserEntityCount
		};

		const petalClover = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === "clover")!;
		const petalMagicLeaf = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === "magic_leaf")!;
		this.gameClient.florrio.utils.getPetals().forEach((petal) => {
			petal.rarities.forEach((_, rarity) => {
				dpss.push({
					petal: {
						sid: petal.sid,
						rarity
					},
					dps: new PetalDPSCalculator(this.gameClient, {
						petal,
						petalRarity: rarity,
						mob,
						mobRarity: this.dpsCalculatorManifest.targetMOBRarity!,
						state: dpsStateBaseOptions
					}).calc()
				});

				if (petal.sid === "dice") {
					petalClover.rarities.forEach((_, cloverRarity) => {
						const luck = (findTranslation<[number]>(_.tooltip!, "Petal/Attribute/Luck") || [])[1] || 0;
						dpss.push({
							petal: {
								sid: petal.sid,
								rarity
							},
							dps: new PetalDPSCalculator(this.gameClient, {
								petal,
								petalRarity: rarity,
								mob,
								mobRarity: this.dpsCalculatorManifest.targetMOBRarity!,
								state: {
									...dpsStateBaseOptions,
									flowerLuck: this.dpsCalculatorManifest.flowerBaseLuck + luck
								}
							}).calc(),
							cloverRarity
						});
					});
				} else if (petal.sid === "magic_stick") {
					const _ = petalMagicLeaf.rarities[toRarityIndex("ultra")]!;
					const manaPerSecond = (findTranslation<[number]>(_.tooltip!, "Petal/Attribute/ManaPerSecond") || [])[1] || 0;

					for (let n = 1; n <= 7; n++) {
						const flowerManaPerSecond = manaPerSecond * n;
						dpss.push({
							petal: {
								sid: petal.sid,
								rarity
							},
							dps: new PetalDPSCalculator(this.gameClient, {
								petal,
								petalRarity: rarity,
								mob,
								mobRarity: this.dpsCalculatorManifest.targetMOBRarity!,
								state: {
									...dpsStateBaseOptions,
									flowerManaPerSecond
								}
							}).calc(),
							ultraMagicLeafCount: n
						});
					}
				}
			});
		});
		return dpss;
	}

	public evaluationsToMarkdown(results: PetalEvaluation[]) {
		results = results.filter((result) => {
			const petal = this.gameClient.florrio.utils.getPetals().find((petal) => (petal.sid === result.petal.sid))!;
			if ((petal.magicPetal) && (!["magic_stick"].includes(petal.sid))) return false;

			// unique
			if (["mjolnir", "crown"].includes(result.petal.sid)) {
				return (result.petal.rarity >= toRarityIndex("unique"));
			}
			if (
				(toRaritySID(result.petal.rarity) === "unique") &&
				(["starfish"/*xayo*/, "bone"].includes(result.petal.sid))
			) {
				return true;
			}

			// ultra
			if (
				(toRaritySID(result.petal.rarity) === "ultra") &&
				(["lightning", "stick", "moon", "wax", "magic_stick"].includes(result.petal.sid))
			) {
				return true;
			}

			// super
			if (result.petal.rarity !== toRarityIndex("super")) {
				return false;
			}

			// clover
			if (
				(typeof result.cloverRarity === "number") &&
				(
					(result.cloverRarity < toRarityIndex("ultra")) ||
					(result.cloverRarity > toRarityIndex("super"))
				)
			) {
				return false;
			}

			return true;
		});

		let baseEvaluationText = `## Base Evaluation\n|Petal|Rarity|Note|Score|DPS|\n|:-:|:-:|:-:|:-:|:-:|\n`;
		baseEvaluationText += results
			.map((score) => {
				let note = "";
				if (typeof score.cloverRarity === "number") note = `with \`${toRaritySID(score.cloverRarity)}\` \`clover\``;
				if (typeof score.ultraMagicLeafCount === "number") note = `with ${score.ultraMagicLeafCount}x \`ultra\` \`magic_leaf\``;
				return {
					petalSID: score.petal.sid,
					petalRarity: score.petal.rarity,
					cloverRarity: score.cloverRarity,
					score: score.score,
					dps: score.dps,
					note
				};
			})
			.sort(({ petalSID: a1, petalRarity: a2, cloverRarity: a3 }, { petalSID: b1, petalRarity: b2, cloverRarity: b3 }) => {
				if (a1 !== b1) return a1 > b1 ? 1 : -1;
				if (a2 !== b2) return a2 > b2 ? 1 : -1;
				if (((typeof a3 === "number") && (typeof b3 === "number")) && (a3 !== b3)) return a3 > b3 ? 1 : -1;
				return 0;
			})
			.map(({ petalSID, petalRarity, note, score, dps }) => {
				return `|\`${petalSID}\`|\`${toRaritySID(petalRarity)}\`|${note}|${score.toFixed(1)}|${Math.round(dps)}|`;
			}).join("\n");

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
		return `${baseEvaluationText}\n${additionalEvaluationText}`;
	}

}