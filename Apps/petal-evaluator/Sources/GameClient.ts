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

}