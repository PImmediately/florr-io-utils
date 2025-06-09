import Entity from "./Entity";

import { type Mob, findTranslation } from "./../../GameTypes";

export default class EntityMOB extends Entity {

	public constructor(public readonly mob: Mob, public readonly rarity: number) {
		super();
	}

	private getTooltip() {
		const tooltip = this.mob.rarities[this.rarity]?.tooltip;
		if (!tooltip) throw new Error(`MOB tooltip not found`);
		return tooltip;
	}

	public getMaxHealth() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Mob/Attribute/Health") || [])[1];
	}

	public getDamage() {
		const tooltip = this.getTooltip();
		return (
			findTranslation<[number]>(tooltip, "Mob/Attribute/Damage/Lightning") ||
			findTranslation<[number]>(tooltip, "Mob/Attribute/Damage") || []
		)[1] || 0;
	}

	public getArmor() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Mob/Attribute/Armor") || [])[1];
	}

	public getUndeadDuration() {
		const tooltip = this.getTooltip();
		return (findTranslation<[number]>(tooltip, "Mob/Attribute/UndeadDuration") || [])[1];
	}

}