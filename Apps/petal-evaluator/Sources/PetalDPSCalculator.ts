import type GameClient from "./GameClient";
import { findTranslation, toRarityIndex, type MobType, type Petal } from "./GameTypes";

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
	flowerLuck: number;
	flowerTalentPoisonMultiplier: number;
	flowerManaPerSecond: number;

	maxLigntningBounces: number;
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

export default class PetalDPSCalculator {

	public constructor(public readonly gameClient: GameClient, public readonly options: PetalDPSCalculatorOptions) {
	}

	public calc() {
		const petalInfo = this.getPetalInfo({
			petal: {
				sid: this.options.petal.sid,
				rarity: this.options.petalRarity
			},
			flowerLuck: this.options.state.flowerLuck
		});
		if (petalInfo.damage <= 0) return 0;

		const targetTooltip = this.options.mob.rarities[this.options.mobRarity]?.tooltip;
		if (!targetTooltip) throw new Error(`MOB tooltip not found`);
		const targetDamage = (findTranslation<[number]>(targetTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
		const targetArmor = (findTranslation<[number]>(targetTooltip, "Mob/Attribute/Armor") || [])[1] || 0;

		let hitCount = Math.ceil(petalInfo.health / (targetDamage + targetArmor - petalInfo.armor));
		{
			// lightning
			if (petalInfo.isDamageLightning) {
				hitCount = 1;
			}

			// evasion
			if (petalInfo.evasionChance > 0) {
				hitCount *= 1 / (1 - petalInfo.evasionChance);
			}
		}
		if (typeof petalInfo.duration === "number") {
			hitCount = Math.min(hitCount, TPS * petalInfo.duration);
		}

		let totalDamage = petalInfo.damage;
		{
			// peas & grapes
			let isSingleBeforeProjectile = false;
			if (["peas", "grapes"].includes(this.options.petal.sid)) {
				isSingleBeforeProjectile = true;
			}

			if (!isSingleBeforeProjectile) {
				totalDamage *= petalInfo.numCopies;
			}
		}

		let dps = 0;
		if (typeof petalInfo.reloadTime === "number") {
			const time = petalInfo.reloadTime * this.options.state.flowerTalentReloadMultiplier + ((typeof petalInfo.activationTime === "number") ? petalInfo.activationTime : 0) + 1000 / TPS * hitCount;
			dps = (totalDamage * hitCount * ((typeof petalInfo.spawnCount === "number") ? petalInfo.spawnCount : 1)) / (time / 1000);
			dps += petalInfo.lightningDPS;
			dps += petalInfo.poisonDPS * this.options.state.flowerTalentPoisonMultiplier;
		}
		if (typeof petalInfo.damageDPS === "number") {
			dps = petalInfo.damageDPS;
		}
		return dps;
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

		let duration: number | undefined;
		let health = 0;
		let damage = 0;
		let damageDPS: number | undefined;
		let isDamageLightning = false;
		let lightningDPS = 0;
		let poisonDPS = 0;
		let armor = 0;
		let reloadTime: number | undefined;
		let activationTime: number | undefined;
		let numCopies = 1;
		let spawnCount: number | undefined;
		let evasionChance = 0;

		const tooltip = petal.rarities[options.petal.rarity]?.tooltip;
		if (tooltip) {
			health = (findTranslation<[number]>(tooltip, "Petal/Attribute/Health") || [])[1] || 0;
			{
				// for card
				const health4 = findTranslation<[number, number, number, number]>(tooltip, "Petal/Attribute/Health4");
				if (Array.isArray(health4)) {
					const healths = health4.slice(1) as [number, number, number, number];
					health = healths.reduce((sum, ele) => sum + ele, 0) / healths.length;
				}
			}

			damage = (findTranslation<[number]>(tooltip, "Petal/Attribute/Damage") || [])[1] || 0;
			{
				// for dice
				if (petal.sid === "dice") {
					const criticalChance = 0.05 + 0.04 * options.flowerLuck;
					damage *= 35 * criticalChance + 1 * (1 - criticalChance);
				}

				// for tomato & domino
				{
					const damageRange = findTranslation<[number, number]>(tooltip, "Petal/Attribute/DamageRange");
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
					const damage4 = findTranslation<[number, number, number, number]>(tooltip, "Petal/Attribute/Damage4");
					if (Array.isArray(damage4)) {
						const damages = damage4.slice(1) as [number, number, number, number];
						damage = damages.reduce((sum, ele) => sum + ele, 0) / damages.length;
					}
				}

				// for glass
				{
					const interval = findTranslation<[number]>(tooltip, "Petal/Attribute/Interval");
					if (Array.isArray(interval)) {
						damageDPS = damage / interval[1];
					}
				}

				// lightning
				{
					const lightning = (findTranslation<[number]>(tooltip, "Petal/Attribute/Lightning") || [])[1];
					isDamageLightning = (typeof lightning === "number");
					if (lightning) {
						damage = lightning;
					}

					const bounces = (findTranslation<[number]>(tooltip, "Petal/Attribute/Bounces") || [])[1];
					if (typeof bounces === "number") {
						damage *= Math.min(bounces, this.options.state.maxLigntningBounces);
					}

					// for laser
					lightningDPS = (findTranslation<[number]>(tooltip, "Petal/Attribute/DamagePerSecond/Lightning") || [])[1] || 0;
					if (petal.sid === "laser") {
						lightningDPS *= this.options.state.touchedLaserEntityCount;
					}
				}
			}

			// poison
			const poison = findTranslation<[number, number]>(tooltip, "Petal/Attribute/Poison");
			if (Array.isArray(poison)) {
				poisonDPS = poison[2] || 0;
			}

			// armor
			armor = (findTranslation<[number]>(tooltip, "Petal/Attribute/Armor") || [])[1] || 0;

			// for summoner
			const contents = (findTranslation<[number, MobType]>(tooltip, "Petal/Attribute/Contents") || [])[2];
			if (contents) {
				const contentMOB = this.gameClient.florrio.utils.getMobs().find(m => m.sid === contents[1]);
				if (!contentMOB) throw new Error(`Mob with SID ${contents[2]} not found`);

				const contentMOBTooltip = contentMOB.rarities[toRarityIndex(contents[2])]?.tooltip
				if (!contentMOBTooltip) throw new Error(`Mob with SID ${contents[2]} not found`);
				health = ((findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Health") || [])[1] || 0) * this.options.state.flowerTalentSummonerMultiplier;
				damage = (findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
				armor = (findTranslation<[number]>(contentMOBTooltip, "Mob/Attribute/Armor") || [])[1] || 0;
			}

			const spawn = (findTranslation<[number, MobType]>(tooltip, "Petal/Attribute/Spawn") || [])[2];
			if (spawn) {
				const spawnMOB = this.gameClient.florrio.utils.getMobs().find(m => m.sid === spawn[1]);
				if (!spawnMOB) throw new Error(`Mob with SID ${spawn[2]} not found`);

				const spawnMOBTooltip = spawnMOB.rarities[toRarityIndex(spawn[2])]?.tooltip
				if (!spawnMOBTooltip) throw new Error(`Mob with SID ${spawn[2]} not found`);
				health = ((findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Health") || [])[1] || 0) * this.options.state.flowerTalentSummonerMultiplier;
				damage = (findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Damage") || [])[1] || 0;
				armor = (findTranslation<[number]>(spawnMOBTooltip, "Mob/Attribute/Armor") || [])[1] || 0;

				const spawnManaCost = (findTranslation<[number]>(tooltip, "Petal/Attribute/SpawnManaCost") || [])[1];
				duration = (findTranslation<[number]>(tooltip, "Petal/Attribute/Duration") || [])[1];
				if ((typeof spawnManaCost === "number") && (typeof duration === "number")) {
					spawnCount = Math.min((duration * this.options.state.flowerManaPerSecond / spawnManaCost), duration);
				}
			}

			for (let i = 0; i <= options.petal.rarity; i++) {
				const rarity = petal.rarities[i]!;
				if (typeof rarity.reloadTime === "number") reloadTime = rarity.reloadTime;
				if (typeof rarity.activationTime === "number") activationTime = rarity.activationTime;
				if (typeof rarity.numCopies === "number") numCopies = rarity.numCopies;
			}
			if ((this.options.state.flowerTalentDuplicator) && (numCopies >= 2)) numCopies++;

			// evasion
			evasionChance = (findTranslation<[number]>(tooltip, "Petal/Attribute/Evasion") || [])[1] || 0
		}

		return {
			duration,
			health,
			damage,
			damageDPS,
			isDamageLightning,
			lightningDPS,
			armor,
			poisonDPS,
			evasionChance,
			reloadTime,
			activationTime,
			numCopies,
			spawnCount
		};
	}

}