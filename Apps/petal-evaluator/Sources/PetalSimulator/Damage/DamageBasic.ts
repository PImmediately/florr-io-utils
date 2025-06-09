import Damage from "./Damage";

export default class DamageBasic extends Damage {

	public constructor(at: number, public readonly amount: number) {
		super(at);
	}

}