import Entity from "./Entity";

import { MobType, type Petal, findTranslation, getRarity } from "./../../GameTypes";

export default class EntityPetal extends Entity {

	public constructor(public readonly petal: Petal, public readonly rarity: number) {
		super();
	}

	private getTooltip() {
		const tooltip = this.getRarity().tooltip;
		if (!tooltip) throw new Error(`Petal tooltip not found`);
		return tooltip;
	}

	private getRarity() {
		return getRarity(this.petal.rarities, this.rarity);
	}

	public getMaxHealth() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Health") || [])[1];
	}

	public getDamage() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Damage") || [])[1];
	}

	public getArmor() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Armor") || [])[1];
	}

	public getPoison() {
		const tooltip = this.getTooltip();
		const _ = findTranslation<[number, number]>(tooltip, "Petal/Attribute/Poison");
		return _?.slice(1) as [number, number] | undefined;
	}

	public getLightning() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Lightning") || [])[1];
	}

	public getBounces() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Bounces") || [])[1];
	}

	public getDamageLightning() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Damage/Lightning") || [])[1];
	}

	public getDamageRange() {
		const tooltip = this.getTooltip();
		const _ = findTranslation<[number, number]>(tooltip, "Petal/Attribute/DamageRange");
		return _?.slice(1) as [number, number] | undefined;
	}

	public getHealth4() {
		const tooltip = this.getTooltip();
		const _ = findTranslation<[number, number, number, number]>(tooltip, "Petal/Attribute/Health4");
		return _?.slice(1) as [number, number, number, number] | undefined;
	}

	public getDamage4() {
		const tooltip = this.getTooltip();
		const _ = findTranslation<[number, number, number, number]>(tooltip, "Petal/Attribute/Damage4");
		return _?.slice(1) as [number, number, number, number] | undefined;
	}

	public getInterval() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Interval") || [])[1];
	}

	public getDamagePerSecondLightning() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/DamagePerSecond/Lightning") || [])[1];
	}

	public getReloadTime() {
		const rarity = this.getRarity();
		return rarity.reloadTime;
	}

	public getActivationTime() {
		const rarity = this.getRarity();
		return rarity.activationTime;
	}

	public getNumCopies() {
		const rarity = this.getRarity();
		return rarity.numCopies || 1;
	}

	public hasLightningDamage() {
		const tooltip = this.getTooltip();
		const lightning = (findTranslation<[number]>(tooltip, "Petal/Attribute/Lightning") || [])[1];
		return (typeof lightning === "number");
	}

	public getEvasionChance() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Petal/Attribute/Evasion") || [])[1] || 0;
	}

	public getContents() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number, MobType]>(tooltip, "Petal/Attribute/Contents") || [])[2];
	}

	public getSpawn() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number, MobType]>(tooltip, "Petal/Attribute/Spawn") || [])[2];
	}

	public getSpawnManaCost() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number, number]>(tooltip, "Petal/Attribute/SpawnManaCost") || [])[1];
	}

	public getDuration() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number, number]>(tooltip, "Petal/Attribute/Duration") || [])[1];
	}

}