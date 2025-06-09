import type { Mob, Petal, Talent } from "./GameTypes";

export default class GameClient {

	public constructor(private readonly mob: Mob[], private readonly petal: Petal[], private readonly talent: Talent[]) {
	}

	public get florrio() {
		return {
			utils: {
				getMobs: () => this.mob,
				getPetals: () => this.petal,
				getTalents: () => this.talent,
			}
		};
	}

	public petalSIDToID(sid: string) {
		const id = this.florrio.utils.getPetals().find((petal) => (petal.sid === sid))?.id;
		if (typeof id !== "number") throw new TypeError(`Petal ${sid} not found`);
		return id;
	}

	public mobSIDToID(sid: string) {
		const id = this.florrio.utils.getMobs().find((mob) => (mob.sid === sid))?.id;
		if (typeof id !== "number") throw new TypeError(`MOB ${sid} not found`);
		return id;
	}

}