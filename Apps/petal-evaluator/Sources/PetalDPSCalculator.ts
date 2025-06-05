import type GameClient from "./GameClient";
import { findTranslation, toRarityIndex, getRarity, type MobType, type Petal } from "./GameTypes";

export interface PetalDPSCalculatorOptions {
	petal: Petal;
	petalRarity: number;
	mob: Petal;
	mobRarity: number;
	state: PetalDPSCalculatorOptionsState;
}

export interface PetalDPSCalculatorOptionsState {
	flowerTalentDuplicator: boolean;
	flowerTalentReloadMultiplier: number;
	flowerTalentSummonerMultiplier: number;

	flowerPetalRotation: number;
	flowerLuck: number;
	flowerTalentPoisonMultiplier: number;
	flowerManaPerSecond: number;

	flowerHasThirdEye: boolean;

	maxLigntningBounces: number;
	touchedGlassEntityCount: number;
	touchedLaserEntityCount: number;
}

const petalDominoProducts = new Array<number>();
for (let a = 0; a <= 6; a++) {
	for (let b = 0; b <= a; b++) {
		petalDominoProducts.push(a * b);
	}
}
const petalDominoMaxBaseDamage = Math.max(...petalDominoProducts);
const petalDominoBaseDamage = petalDominoProducts.map((p) => p / petalDominoProducts.length).reduce((sum, ele) => sum + ele);

const TPS = 25;

const SIMULATION_DURATION = 30 * TPS;
const MAX_COLLIDABLE_PHASE = Math.PI * 0.6/*magic number from ultra rice*/;

export default class PetalDPSCalculator {

	public constructor(public readonly gameClient: GameClient, public readonly options: PetalDPSCalculatorOptions) {
	}

	public calc() {
		let dps = 0;
		let isOverMaxCollidablePhase = false;

		const petalInfo = this.getPetalInfo({
			petal: {
				sid: this.options.petal.sid,
				rarity: this.options.petalRarity
			},
			flowerLuck: this.options.state.flowerLuck
		});
		if (petalInfo.damage > 0) {

			const targetTooltip = this.options.mob.rarities[this.options.mobRarity]?.tooltip;
			if (!targetTooltip) throw new Error(`MOB tooltip not found`);
			const targetDamage = (findTranslation<[number]>(targetTooltip, "Mob/Attribute/Damage/Lightning") || findTranslation<[number]>(targetTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
			const targetArmor = (findTranslation<[number]>(targetTooltip, "Mob/Attribute/Armor") || [])[1] || 0;

			const damageToPetal = targetDamage + targetArmor - petalInfo.armor;
			let hitCount = (damageToPetal > 0) ? Math.ceil(petalInfo.health / damageToPetal) : Infinity;
			{
				if (petalInfo.isMultihitable) {
					hitCount = 1;
				}

				// evasion
				if (petalInfo.evasionChance > 0) {
					hitCount *= 1 / (1 - petalInfo.evasionChance);
				}

				// for coral
				if (this.options.petal.sid === "coral") {
					hitCount += 2;
				}

				// undead
				if (typeof petalInfo.undeadDuration === "number") {
					hitCount += TPS * petalInfo.undeadDuration;
				}
			}
			if (typeof petalInfo.duration === "number") {
				hitCount = Math.min(hitCount, TPS * petalInfo.duration);
			}

			let damageToTarget = Math.max(0, petalInfo.damage - targetArmor);
			{
				// peas & grapes
				let isSingleBeforeProjectile = false;
				if (["peas", "grapes"].includes(this.options.petal.sid)) {
					isSingleBeforeProjectile = true;
				}

				if (!isSingleBeforeProjectile) {
					damageToTarget *= petalInfo.numCopies;
				}
			}

			const petalReloadTime = (petalInfo.reloadTime || 0) * this.options.state.flowerTalentReloadMultiplier;
			if (
				(typeof petalInfo.reloadTime === "number") &&
				(petalInfo.isOnOrbit)
			) {
				let petalReloaded = true;
				let petalReloadTick = 0;

				let petalHitCount = 0;
				let totalDamageToTarget = 0;

				isOverMaxCollidablePhase = this.options.state.flowerPetalRotation / TPS * hitCount >= MAX_COLLIDABLE_PHASE;
				for (let t = 0; t < SIMULATION_DURATION; t++) {
					const phase = this.options.state.flowerPetalRotation * (t / TPS) % (2 * Math.PI);

					const isCollidable = (phase >= 0) && (phase <= MAX_COLLIDABLE_PHASE);
					let hit = false;
					if (petalReloaded) {
						if (isCollidable) {
							hit = true;
						}
					} else {
						petalReloadTick++;
						if (petalReloadTick >= petalReloadTime / 1000 * TPS) {
							petalReloaded = true;
						}
					}

					if (hit) {
						petalHitCount++;

						totalDamageToTarget += damageToTarget;
						if (petalHitCount >= hitCount) {
							petalHitCount = 0;
							petalReloaded = false;
							petalReloadTick = 0;
						}
					}
				}

				dps = totalDamageToTarget / SIMULATION_DURATION * TPS;
			} else {
				const time = petalReloadTime + (petalInfo.activationTime || 0) + 1000 / TPS * hitCount;
				dps = (damageToTarget * hitCount * ((typeof petalInfo.spawnCount === "number") ? petalInfo.spawnCount : 1)) / (time / 1000);
			}
			if (typeof petalInfo.damageDPS === "number") {
				dps = petalInfo.damageDPS;
			}
			dps += petalInfo.lightningDPS;
			dps += petalInfo.poisonDPS * this.options.state.flowerTalentPoisonMultiplier;
		}

		return {
			dps,
			isOverMaxCollidablePhase,
		};
	}

	private getPetalInfo(options: {
		petal: {
			sid: string;
			rarity: number;
		};
		flowerLuck: number;
	}) {
		const petal = this.gameClient.florrio.utils.getPetals().find(petal => petal.sid === options.petal.sid);
		if (!petal) throw new Error(`Petal with SID ${options.petal.sid} not found`);

		let isOnOrbit = true;
		let duration: number | undefined;
		let health = 0;
		let damage = 0;
		let damageDPS: number | undefined;
		let isMultihitable = false;
		let lightningDPS = 0;
		let poisonDPS = 0;
		let armor = 0;
		let reloadTime: number | undefined;
		let activationTime: number | undefined;
		let numCopies = 1;
		let spawnCount: number | undefined;
		let evasionChance = 0;
		let undeadDuration: number | undefined;

		const rarity = getRarity(petal.rarities, options.petal.rarity);
		if (rarity.tooltip) {
			health = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Health") || [])[1] || 0;
			{
				// for card
				const health4 = findTranslation<[number, number, number, number]>(rarity.tooltip, "Petal/Attribute/Health4");
				if (Array.isArray(health4)) {
					const healths = health4.slice(1) as [number, number, number, number];
					health = healths.reduce((sum, ele) => sum + ele, 0) / healths.length;
				}
			}

			damage = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Damage") || [])[1] || 0;
			{
				// for dice
				if (petal.sid === "dice") {
					const criticalChance = 0.05 + 0.04 * options.flowerLuck;
					damage *= 35 * criticalChance + 1 * (1 - criticalChance);
				}

				// for tomato & domino
				{
					const damageRange = findTranslation<[number, number]>(rarity.tooltip, "Petal/Attribute/DamageRange");
					if (Array.isArray(damageRange)) {
						if (petal.sid === "tomato") {
							const damages = damageRange.slice(1) as [number, number];
							damage = damages.reduce((sum, ele) => sum + ele, 0) / damages.length;
						} else if (petal.sid === "domino") {
							const damages = damageRange.slice(1) as [number, number];
							damage = damages[1] * petalDominoBaseDamage / petalDominoMaxBaseDamage;
						}
					}
				}

				// for card
				{
					const damage4 = findTranslation<[number, number, number, number]>(rarity.tooltip, "Petal/Attribute/Damage4");
					if (Array.isArray(damage4)) {
						const damages = damage4.slice(1) as [number, number, number, number];
						damage = damages.reduce((sum, ele) => sum + ele, 0) / damages.length;
					}
				}

				// for glass
				{
					const interval = findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Interval");
					if (Array.isArray(interval)) {
						damageDPS = damage / interval[1];
						damageDPS *= this.options.state.touchedGlassEntityCount;
					}
				}

				// lightning
				{
					const lightning = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Lightning") || [])[1];
					isMultihitable = (typeof lightning === "number");
					if (lightning) {
						damage = lightning;
					}

					const bounces = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Bounces") || [])[1];
					if (typeof bounces === "number") {
						damage *= Math.min(bounces, this.options.state.maxLigntningBounces);
					}

					// for laser
					lightningDPS = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/DamagePerSecond/Lightning") || [])[1] || 0;
					if (petal.sid === "laser") {
						lightningDPS *= this.options.state.touchedLaserEntityCount;
					}

					const damageLightning = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Damage/Lightning") || [])[1];
					if (typeof damageLightning === "number") {
						damage = damageLightning;
					}
				}
			}

			// poison
			const poison = findTranslation<[number, number]>(rarity.tooltip, "Petal/Attribute/Poison");
			if (Array.isArray(poison)) {
				poisonDPS = poison[2] || 0;
			}

			// armor
			armor = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Armor") || [])[1] || 0;

			// for summoner
			const contents = (findTranslation<[number, MobType]>(rarity.tooltip, "Petal/Attribute/Contents") || [])[2];
			if (contents) {
				const contentMOB = this.gameClient.florrio.utils.getMobs().find(m => m.sid === contents[1]);
				if (!contentMOB) throw new Error(`Mob with SID ${contents[2]} not found`);

				const contentMOBTooltip = getRarity(contentMOB.rarities, toRarityIndex(contents[2]))?.tooltip;
				if (!contentMOBTooltip) throw new Error(`Mob with SID ${contents[2]} not found`);
				health = ((findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Health") || [])[1] || 0) * this.options.state.flowerTalentSummonerMultiplier;
				damage = (findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
				armor = (findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Armor") || [])[1] || 0;

				isOnOrbit = false;
			}

			const spawn = (findTranslation<[number, MobType]>(rarity.tooltip, "Petal/Attribute/Spawn") || [])[2];
			if (spawn) {
				const spawnMOB = this.gameClient.florrio.utils.getMobs().find(m => m.sid === spawn[1]);
				if (!spawnMOB) throw new Error(`Mob with SID ${spawn[2]} not found`);

				const spawnMOBTooltip = getRarity(spawnMOB.rarities, toRarityIndex(spawn[2]))?.tooltip;
				if (!spawnMOBTooltip) throw new Error(`Mob with SID ${spawn[2]} not found`);
				health = ((findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Health") || [])[1] || 0) * this.options.state.flowerTalentSummonerMultiplier;
				damage = (findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
				armor = (findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Armor") || [])[1] || 0;
				undeadDuration = (findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/UndeadDuration") || [])[1];

				const spawnManaCost = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/SpawnManaCost") || [])[1];
				duration = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Duration") || [])[1];
				if ((typeof spawnManaCost === "number") && (typeof duration === "number")) {
					spawnCount = Math.min((duration * this.options.state.flowerManaPerSecond / spawnManaCost), duration);
				}

				isOnOrbit = false;
			}

			if (typeof rarity.reloadTime === "number") reloadTime = rarity.reloadTime;
			if (typeof rarity.activationTime === "number") activationTime = rarity.activationTime;
			if (typeof rarity.numCopies === "number") numCopies = rarity.numCopies;
			if ((this.options.state.flowerTalentDuplicator) && (numCopies >= 2)) numCopies++;

			// crown
			if (petal.sid === "crown") {
				spawnCount = (undeadDuration || 0) / (((reloadTime || 0) + (activationTime || 0)) / 1000);
			}

			// evasion
			evasionChance = (findTranslation<[number]>(rarity.tooltip, "Petal/Attribute/Evasion") || [])[1] || 0
		}

		// moon & wax
		if (["moon", "wax"].includes(petal.sid)) {
			isOnOrbit = false;
		}

		return {
			isOnOrbit,
			duration,
			health,
			damage,
			damageDPS,
			isMultihitable,
			lightningDPS,
			armor,
			poisonDPS,
			evasionChance,
			reloadTime,
			activationTime,
			numCopies,
			spawnCount,
			undeadDuration
		};
	}

}