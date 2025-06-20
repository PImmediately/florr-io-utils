import { findTranslation, toRarityIndex, toRaritySID } from "./../GameTypes";
import type GameClient from "./../GameClient";

import EntityMOB from "./../PetalSimulator/Entity/EntityMOB";
import EntityPetal from "./../PetalSimulator/Entity/EntityPetal";

import PetalDPSCalculator from "./../PetalSimulator/PetalDPSCalculator";
import PetalSimulator from "./../PetalSimulator/PetalSimulator";

export interface PetalEvaluatorOptions {
	mob: {
		id: number;
		rarity: number;
	};
	basePetal: {
		id: number;
		rarity: number;
	};
	state: {
		area: AreaOptions;
		flower: FlowerOptions;
	};
	scoreMultiplier: Record<number, number>;
	scoreOverrider: Record<number, (rarity: number) => number>;
}

export interface AreaOptions {
	hasManyMOBs: boolean;
	maxLigntningBounces: number;
	touchedGlassEntityCount: number;
	touchedLaserEntityCount: number;
}

export interface FlowerOptions {
	petalRotation: number;
	talentDuplicator: boolean;
	talentReloadMultiplier: number;
	talentSummonerMultiplier: number;
	talentPoisonMultiplier: number;
	luck: number;
	hasThirdEye: boolean;
	manaPerSecond: number;
}

export interface PetalEvaluatorEvaluation {
	calculator: PetalDPSCalculator;
	evaluation: {
		score: number;
		damagePerSecondOnOneMOB: number;
		damagePerSecondOnArea: number;
	};
}

export default class PetalEvaluator {

	public name: string | null = null;

	public options: PetalEvaluatorOptions;

	public static readonly FLOWER_BASE_LUCK = 0.2 * 4;

	public constructor(public readonly gameClient: GameClient, options: Partial<PetalEvaluatorOptions> = {}) {
		const area: AreaOptions = {
			hasManyMOBs: false,
			maxLigntningBounces: 4,
			touchedGlassEntityCount: 2.25,
			touchedLaserEntityCount: 3
		};
		const flower: FlowerOptions = {
			petalRotation: 4.0,
			talentDuplicator: true,
			talentPoisonMultiplier: 1.8,
			talentSummonerMultiplier: 1 + 0.07 * 8,
			talentReloadMultiplier: 0.5,
			luck: PetalEvaluator.FLOWER_BASE_LUCK,
			hasThirdEye: false,
			manaPerSecond: 0
		};
		const defaultOptions: PetalEvaluatorOptions = {
			mob: {
				id: this.gameClient.mobSIDToID("ant_soldier"),
				rarity: toRarityIndex("ultra")
			},
			basePetal: {
				id: this.gameClient.petalSIDToID("coin"),
				rarity: toRarityIndex("super")
			},
			state: {
				flower,
				area
			},
			scoreMultiplier: {
				[this.gameClient.petalSIDToID("missile")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("grapes")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("pollen")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("pincer")]: 1.5, // reducing enemies' movement speed
				[this.gameClient.petalSIDToID("magnet")]: 0,
				[this.gameClient.petalSIDToID("pearl")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("peas")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("poo")]: 0,
				[this.gameClient.petalSIDToID("bulb")]: 0,
				[this.gameClient.petalSIDToID("carrot")]: 0.25, // projectile
				[this.gameClient.petalSIDToID("plank")]: 0,
				[this.gameClient.petalSIDToID("rubber")]: 0,
				[this.gameClient.petalSIDToID("compass")]: 0,
				[this.gameClient.petalSIDToID("mecha_missile")]: 0.25, // projectile
			},
			scoreOverrider: {}
		};
		this.options = { ...defaultOptions, ...options };
	}

	public evaluate(): PetalEvaluatorEvaluation[] {
		const calculators = this.getCalculators();

		const baseCalculator = calculators.find((calculator) => (
			(calculator.simulator.options.petal.petal.id === this.options.basePetal.id) &&
			(calculator.simulator.options.petal.rarity === this.options.basePetal.rarity)
		));
		if (!baseCalculator) throw new Error("Base petal not found");
		const baseDamagePerSecondOnArea = baseCalculator.calc().damagePerSecondOnArea;

		return calculators.map((calculator) => {
			const result = calculator.calc();

			const actualScore = result.damagePerSecondOnArea / baseDamagePerSecondOnArea;

			const scoreMultiplier = this.options.scoreMultiplier[calculator.simulator.options.petal.petal.id];
			let score = actualScore * ((typeof scoreMultiplier === "number") ? scoreMultiplier : 1);
			if (calculator.simulator.options.petal.petal.id in this.options.scoreOverrider) {
				score = this.options.scoreOverrider[calculator.simulator.options.petal.petal.id]!(calculator.simulator.options.petal.rarity);
			}
			if (
				(calculator.simulator.options.petal.petal.sid !== "glass") &&
				(result.isOverMaxCollidablePhase) &&
				(calculator.options.area.hasManyMOBs)
			) {
				score *= 1.5;
			}

			const evaluation: PetalEvaluatorEvaluation = {
				calculator,
				evaluation: {
					...result,
					score
				}
			};
			return evaluation;
		});
	}

	private getCalculators() {
		const mob = this.gameClient.florrio.utils.getMobs().find(mob => mob.id === this.options.mob.id);
		if (!mob) throw new Error("Target MOB not found");
		const mobEntity = new EntityMOB(mob, this.options.mob.rarity);

		const petalClover = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === "clover")!;

		const calculators = new Array<PetalDPSCalculator>();
		this.gameClient.florrio.utils.getPetals().forEach((petal) => {
			petal.rarities.forEach((_, rarity) => {
				const petalEntity = new EntityPetal(petal, rarity);

				const simulator = new PetalSimulator(this.gameClient, {
					mob: mobEntity,
					petal: petalEntity,
					flower: this.options.state.flower
				});
				const calculator = new PetalDPSCalculator(simulator, {
					area: this.options.state.area
				});
				calculators.push(calculator);

				if (petal.sid === "dice") { // for dice
					petalClover.rarities.forEach((_, cloverRarity) => {
						const luck = (findTranslation<[number]>(_.tooltip!, "Petal/Attribute/Luck") || [])[1] || 0;
						const simulator = new PetalSimulator(this.gameClient, {
							mob: mobEntity,
							petal: petalEntity,
							flower: {
								...this.options.state.flower,
								luck: PetalEvaluator.FLOWER_BASE_LUCK + luck,
							},
							userdata: {
								cloverRarity
							}
						});
						const calculator = new PetalDPSCalculator(simulator, {
							area: this.options.state.area
						});
						calculators.push(calculator);
					});
				} else if (petal.sid === "glass") { // for glass
					const simulator = new PetalSimulator(this.gameClient, {
						mob: mobEntity,
						petal: petalEntity,
						flower: {
							...this.options.state.flower,
							hasThirdEye: true
						}
					});
					const calculator = new PetalDPSCalculator(simulator, {
						area: this.options.state.area
					});
					calculators.push(calculator);
				} else if (petal.sid === "magic_stick") { // for magic_stick
					["orb", "magic_leaf"].forEach((manaHealPetalSID) => {
						const manaHealPetal = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === manaHealPetalSID)!;
						for (let manaHealPetalRarity = toRarityIndex("ultra"); manaHealPetalRarity <= toRarityIndex("super"); manaHealPetalRarity++) {
							const manaHealPetalEntity = new EntityPetal(manaHealPetal, manaHealPetalRarity);
							const flowerManaPerSecond = new PetalSimulator(this.gameClient, {
								mob: mobEntity, // dummy
								petal: manaHealPetalEntity,
								flower: this.options.state.flower
							}).calcPetalManaPerSecond() || 0;

							const simulator = new PetalSimulator(this.gameClient, {
								mob: mobEntity,
								petal: petalEntity,
								flower: {
									...this.options.state.flower,
									manaPerSecond: flowerManaPerSecond
								},
								userdata: {
									manaHealPetal: manaHealPetalSID,
									manaHealPetalRarity: toRaritySID(manaHealPetalRarity)
								}
							});
							const calculator = new PetalDPSCalculator(simulator, {
								area: this.options.state.area
							});
							calculators.push(calculator);
						}
					});
				}

			});
		});
		return calculators;
	}

}