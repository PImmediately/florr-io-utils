import type GameClient from "./../GameClient";

import type EntityPetal from "./Entity/EntityPetal";
import EntityMOB from "./Entity/EntityMOB";
import { toRarityIndex } from "./../GameTypes";

import type { FlowerOptions } from "./../PetalEvaluator/PetalEvaluator";

import type Damage from "./Damage/Damage";
import DamageBasic from "./Damage/DamageBasic";
import DamagePoison from "./Damage/DamagePoison";
import DamageLightning from "./Damage/DamageLightning";
import DamagePerSecondLightning from "./Damage/DamagePerSecondLightning";

export interface PetalSimulatorOptionsUserdata {
	cloverRarity?: number;
	ultraMagicLeafCount?: number;
}

export interface PetalSimulatorOptions<Userdata = {}> {
	petal: EntityPetal;
	mob: EntityMOB;
	flower: FlowerOptions;
	userdata?: Userdata;
}

const petalDominoProducts = new Array<number>();
for (let a = 0; a <= 6; a++) {
	for (let b = 0; b <= a; b++) {
		petalDominoProducts.push(a * b);
	}
}
const petalDominoMaxBaseDamage = Math.max(...petalDominoProducts);
const petalDominoBaseDamage = petalDominoProducts.map((p) => p / petalDominoProducts.length).reduce((sum, element) => sum + element);

export default class PetalSimulator {

	public static readonly TPS = 25;
	public static readonly MAX_COLLIDABLE_PHASE = Math.PI * 0.6;

	public constructor(public readonly gameClient: GameClient, public readonly options: PetalSimulatorOptions<PetalSimulatorOptionsUserdata>) {
	}

	public simulate() {
		const isPetalOnOrbit = this.isPetalOnOrbit();

		const petalReloadTime = (this.getPetalReloadTime() || 0) * this.options.flower.talentReloadMultiplier;
		let petalReloaded = true;
		let petalReloadTick = 0;
		const petalActivationTime = this.getPetalActivationTime();
		const petalTickToUse = (petalReloadTime + (isPetalOnOrbit ? 0 : petalActivationTime || 0)) / 1000 * PetalSimulator.TPS;

		const petalIntervalTick = (() => {
			const value = this.options.petal.getInterval();
			return ((typeof value === "number") ? value * PetalSimulator.TPS : undefined);
		})();
		let lastDamageAt: number | undefined = undefined;

		const petalNumCopies = this.calcPetalNumCopies();

		const contents = this.options.petal.getContents();
		const spawn = this.options.petal.getSpawn();

		let mobEntity: EntityMOB | undefined;
		if ((contents) || (spawn)) {
			const mobSID = (contents || [])[1] || (spawn || [])[1];
			const mob = this.gameClient.florrio.utils.getMobs().find((mob) => mob.sid === mobSID);
			if (!mob) throw new Error(`Mob with SID ${mobSID} not found`);

			const mobRaritySID = ((contents || [])[2] || (spawn || [])[2])!;
			mobEntity = new EntityMOB(mob, toRarityIndex(mobRaritySID));
		}

		const maxHitCountToTarget = this.calcMaxHitCountToTarget(mobEntity);
		let hitCountToTarget = 0;

		let isOverMaxCollidablePhase = false;
		if (isPetalOnOrbit) {
			isOverMaxCollidablePhase = this.options.flower.petalRotation / PetalSimulator.TPS * maxHitCountToTarget >= PetalSimulator.MAX_COLLIDABLE_PHASE;
		}

		const damages = new Array<Damage>();
		let simulationDuration = isPetalOnOrbit ? PetalSimulator.TPS * 30 : (petalTickToUse + Math.min(maxHitCountToTarget, PetalSimulator.TPS * 300)) * 10;
		for (let t = 0; t < simulationDuration; t++) {
			const phase = this.options.flower.petalRotation * (t / PetalSimulator.TPS) % (2 * Math.PI);

			const isCollidable = isPetalOnOrbit ? ((phase >= 0) && (phase <= PetalSimulator.MAX_COLLIDABLE_PHASE)) : true;
			let hit = false;
			if (petalReloaded) {
				if (isCollidable) {
					hit = true;
				}
			} else {
				petalReloadTick++;
				if (petalReloadTick >= petalTickToUse) {
					petalReloaded = true;
				}
			}

			if (hit) {
				let doDamage = true;
				if (typeof petalIntervalTick === "number") {
					const elapsedTick = t - (lastDamageAt || -Infinity);
					doDamage = (elapsedTick >= petalIntervalTick);
				}
				if (doDamage) {
					for (let i = 0; i < petalNumCopies; i++) damages.push(...this.createDamages(t, mobEntity));
					lastDamageAt = t;
				}

				hitCountToTarget++;
				if (hitCountToTarget >= maxHitCountToTarget) {
					hitCountToTarget = 0;
					petalReloadTick = 0;
					petalReloaded = false;
				}
			}
		}

		return {
			simulationDuration,
			damages,
			isOverMaxCollidablePhase
		};
	}

	private isPetalOnOrbit() {
		if (this.canPetalSummon()) return false;

		// for moon & wax
		if (["moon", "wax"].includes(this.options.petal.petal.sid)) {
			return false;
		}

		return true;
	}

	private canPetalSummon() {
		const contents = this.options.petal.getContents();
		const spawn = this.options.petal.getSpawn();
		return Boolean(contents) || Boolean(spawn);
	}

	private calcPetalSummonCount(mobEntity: EntityMOB) {
		// for magic_stick
		const spawnManaCost = this.options.petal.getSpawnManaCost();
		const duration = this.options.petal.getDuration();
		if ((typeof spawnManaCost === "number") && (typeof duration === "number")) {
			return Math.min((duration * this.options.flower.manaPerSecond / spawnManaCost), duration);
		}

		// for crown
		if (this.options.petal.petal.sid === "crown") {
			return (mobEntity.getUndeadDuration() || 0) / (((this.options.petal.getReloadTime() || 0) + (this.options.petal.getActivationTime() || 0)) / 1000);
		}

		return 1;
	}

	private calcMaxHitCountToTarget(mobEntity?: EntityMOB) {
		if (!mobEntity) {
			if (this.options.petal.hasLightningDamage()) return 1;

			// for laser
			if (this.options.petal.petal.sid === "laser") return Infinity;
		}

		let allyMaxHealth = (!mobEntity) ? this.calcPetalMaxHealth() : mobEntity.getMaxHealth();
		if (typeof allyMaxHealth !== "number") return Infinity;
		if (mobEntity) allyMaxHealth *= this.options.flower.talentSummonerMultiplier;
		const allyArmor = (!mobEntity) ? (this.options.petal.getArmor() || 0) : (mobEntity.getArmor() || 0);

		const targetDamage = this.options.mob.getDamage();
		const targetArmor = this.options.mob.getArmor() || 0;

		const damageToAlly = targetDamage - (allyArmor - targetArmor);
		let hitCount = (damageToAlly > 0) ? Math.ceil(allyMaxHealth / damageToAlly) : Infinity;

		if (!mobEntity) {
			// evasion
			const evasionChance = this.options.petal.getEvasionChance();
			if (evasionChance > 0) {
				hitCount *= 1 / (1 - evasionChance);
			}

			// for coral
			if (this.options.petal.petal.sid === "coral") {
				hitCount += 2;
			}
		}

		return hitCount;
	}

	private getPetalReloadTime() {
		return this.options.petal.getReloadTime();
	}

	private getPetalActivationTime() {
		// for crown
		if (this.options.petal.petal.sid === "crown") return 0;

		return this.options.petal.getActivationTime();
	}

	private calcPetalMaxHealth() {
		let health = this.options.petal.getMaxHealth();

		// for card
		const health4 = this.options.petal.getHealth4();
		if (Array.isArray(health4)) {
			health = health4.reduce((sum, element) => sum + element, 0) / health4.length;
		}

		return health;
	}

	private calcPetalDamage() {
		// for laser
		if (this.options.petal.petal.sid === "laser") return 0;

		let damage = this.options.petal.getDamage();

		if (this.options.petal.petal.sid === "dice") { // for dice
			const criticalChance = 0.05 + 0.04 * this.options.flower.luck;
			damage! *= 35 * criticalChance + 1 * (1 - criticalChance);
		}

		const damageRange = this.options.petal.getDamageRange();
		if (Array.isArray(damageRange)) {
			if (this.options.petal.petal.sid === "tomato") { // for tomato
				damage = damageRange.reduce((sum, element) => sum + element, 0) / damageRange.length;
			} else if (this.options.petal.petal.sid === "domino") { // for domino
				damage = damageRange[1] * petalDominoBaseDamage / petalDominoMaxBaseDamage;
			}
		}

		// for card
		const damage4 = this.options.petal.getDamage4();
		if (Array.isArray(damage4)) {
			damage = damage4.reduce((sum, element) => sum + element, 0) / damage4.length;
		}

		return damage;
	}

	private createDamages(t: number, mobEntity?: EntityMOB) {
		const damages = new Array<Damage>();

		const damage = (!mobEntity) ? this.calcPetalDamage() : mobEntity.getDamage();
		if (typeof damage === "number") {
			const targetArmor = this.options.mob.getArmor() || 0;

			const damageToTarget = damage - targetArmor;
			if (damageToTarget > 0) {
				const totalDamageToTarget = damageToTarget * (mobEntity ? this.calcPetalSummonCount(mobEntity) : 1);
				damages.push(new DamageBasic(t, totalDamageToTarget));
			}
		}

		if (!mobEntity) {
			const petalPoison = this.options.petal.getPoison();
			if (Array.isArray(petalPoison)) {
				const amount = petalPoison[0] * this.options.flower.talentPoisonMultiplier;
				const duration = PetalSimulator.TPS * petalPoison[0] / petalPoison[1];
				damages.push(new DamagePoison(t, amount, duration));
			}

			const petalLightning = this.options.petal.getLightning();
			const petalBounces = this.options.petal.getBounces();
			if ((typeof petalLightning === "number") && (typeof petalBounces === "number")) {
				damages.push(new DamageLightning(t, petalLightning, petalBounces));
			}

			const petalDamageLightning = this.options.petal.getDamageLightning();
			if (typeof petalDamageLightning === "number") {
				damages.push(new DamageLightning(t, petalDamageLightning, 1));
			}

			const petalDamagePerSecondLightning = this.options.petal.getDamagePerSecondLightning();
			if (typeof petalDamagePerSecondLightning === "number") {
				damages.push(new DamagePerSecondLightning(t, petalDamagePerSecondLightning));
			}
		}

		return damages;
	}

	private calcPetalNumCopies() {
		let numCopies = this.options.petal.getNumCopies();
		if ((this.options.flower.talentDuplicator) && (numCopies >= 2)) numCopies++;

		// for peas & grapes
		if (["peas", "grapes"].includes(this.options.petal.petal.sid)) {
			numCopies = 1;
		}

		// for unique mjolnir
		if ((this.options.petal.petal.sid === "mjolnir") && (this.options.petal.rarity === toRarityIndex("unique"))) return 1;

		return numCopies;
	}

}