import Damage from "./Damage";

export default class DamagePoison extends Damage {

	public constructor(at: number, public readonly amount: number, public readonly duration: number) {
		super(at);
	}

}