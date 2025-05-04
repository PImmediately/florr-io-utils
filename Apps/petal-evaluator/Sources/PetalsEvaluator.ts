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

	public evaluationsToText(results: PetalEvaluation[]) {
		results = results.filter((result) => {
			const petal = this.gameClient.florrio.utils.getPetals().find((petal) => (petal.sid === result.petal.sid))!;
			if ((petal.magicPetal) && (!["magic_stick"].includes(petal.sid))) return false;

			// unique
			if (["mjolnir", "crown"].includes(result.petal.sid)) {
				return (result.petal.rarity >= toRarityIndex("unique"));
			}
			if (
				(toRaritySID(result.petal.rarity) === "unique") &&
				(["starfish"/*xayo*/].includes(result.petal.sid))
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

		const texts = results.map((score) => {
			let title = `${toRaritySID(score.petal.rarity)} ${score.petal.sid}`;
			if (typeof score.cloverRarity === "number") title += ` (with ${toRaritySID(score.cloverRarity)} clover)`;
			if (typeof score.ultraMagicLeafCount === "number") title += ` (with ${score.ultraMagicLeafCount} ultra magic_leaf)`;
			return {
				title,
				petalSID: score.petal.sid,
				score: score.score,
				dps: score.dps,
			};
		});
		const longestTitleLength = Math.max(...texts.map(({ title }) => title.length));
		return texts
			.sort(({ petalSID: a1, title: a2 }, { petalSID: b1, title: b2 }) => {
				if (a1 !== b1) return a1 > b1 ? 1 : -1;
				return b1 < b2 ? 1 : -1;
			})
			.map(({ title, score, dps }) => {
				return `${title.padEnd(longestTitleLength, " ")} : ${score.toFixed(1).padStart(4, " ")}   (${Math.round(dps)})`;
			}).join("\n");
	}

}