import type { AreaOptions } from "./../PetalEvaluator/PetalEvaluator";

import PetalSimulator from "./PetalSimulator";

import DamageBasic from "./Damage/DamageBasic";
import DamageLightning from "./Damage/DamageLightning";
import DamagePoison from "./Damage/DamagePoison";
import DamagePerSecondLightning from "./Damage/DamagePerSecondLightning";

export interface PetalDPSCalculatorOptions {
	area: AreaOptions;
}

export default class PetalDPSCalculator {

	public constructor(public readonly simulator: PetalSimulator, public readonly options: PetalDPSCalculatorOptions) {
	}

	public calc() {
		const result = this.simulator.simulate();

		const damages = result.damages.sort((a, b) => a.at - b.at);
		let totalDamageOnOneMOB = 0;
		let totalDamageOnArea = 0;

		let firstPosionDamage: DamagePoison | undefined;
		const poisonTicks = new Set<number>();

		damages.forEach((damage) => {
			if (damage instanceof DamageBasic) {
				const amount = damage.amount;
				totalDamageOnOneMOB += amount;
				if (this.simulator.options.petal.petal.sid === "glass") {
					totalDamageOnArea += amount * this.options.area.touchedGlassEntityCount;
				} else {
					totalDamageOnArea += amount;
				}
			} else if (damage instanceof DamagePoison) {
				if (!firstPosionDamage) firstPosionDamage = damage;
				for (let t = damage.at; t < damage.at + damage.duration; t++) {
					poisonTicks.add(t);
				}
			} else if (damage instanceof DamageLightning) {
				const amount = damage.amount;
				totalDamageOnOneMOB += amount;
				totalDamageOnArea += amount * Math.min(damage.bounces, this.options.area.maxLigntningBounces);
			} else if (damage instanceof DamagePerSecondLightning) {
				const amount = damage.damagePerSecond / PetalSimulator.TPS;
				totalDamageOnOneMOB += amount;
				totalDamageOnArea += amount * this.options.area.touchedLaserEntityCount;
			}
		});

		if (firstPosionDamage) {
			const damagePerTick = firstPosionDamage.amount / firstPosionDamage.duration;
			const amount = damagePerTick * poisonTicks.size;
			totalDamageOnOneMOB += amount;
			totalDamageOnArea += amount;
		}

		return {
			damagePerSecondOnOneMOB: totalDamageOnOneMOB / result.simulationDuration * PetalSimulator.TPS,
			damagePerSecondOnArea: totalDamageOnArea / result.simulationDuration * PetalSimulator.TPS,
			isOverMaxCollidablePhase: result.isOverMaxCollidablePhase
		};
	}

}