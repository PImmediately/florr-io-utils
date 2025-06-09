import Damage from "./Damage";

export default class DamagePerSecondLightning extends Damage {

	public constructor(at: number, public readonly damagePerSecond: number) {
		super(at);
	}

}