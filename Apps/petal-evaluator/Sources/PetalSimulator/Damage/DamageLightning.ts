import Damage from "./Damage";

export default class DamageLightning extends Damage {

	public constructor(at: number, public readonly amount: number, public readonly bounces: number) {
		super(at);
	}

}