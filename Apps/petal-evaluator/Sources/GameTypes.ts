const raritySIDs = ["common", "unusual", "rare", "epic", "legendary", "mythic", "ultra", "super", "unique"] as const;
export type RaritySID = typeof raritySIDs[number];

export function toRaritySID(index: number) {
	const sid = raritySIDs[index];
	if (!sid) throw new Error(`Rarity index ${index} not found`);
	return sid;
}

export function toRarityIndex(sid: RaritySID) {
	const index = raritySIDs.indexOf(sid);
	if (index === -1) throw new Error(`Rarity ${sid} not found`);
	return index;
}

export type MobType = ["m", string, RaritySID]; // base, rarity
export type MobBase = ["mb", string];
export type MobRarity = ["mr", string];

export type PetalType = ["p", string, RaritySID]; // base, rarity
export type PetalBase = ["pb", string];
export type PetalRarity = ["pr", string];

export type TranslationKey = string;
export type TranslationArgument = boolean | string | number | MobType | MobBase | MobRarity | PetalType | PetalBase | PetalRarity;
export type Translation<T extends TranslationArgument[] = TranslationArgument[]> = [TranslationKey, ...T];

export type Tooltip = Translation[];

export interface Petal {
	id: number;
	sid: string;

	isPassive?: boolean;
	isStackable?: boolean;
	magicPetal?: boolean;
	magicVersion?: number;
	premiumPrice?: number;

	rarities: Partial<{
		droppable: boolean;
		shoppable: boolean;
		reloadTime?: number; // ms
		activationTime?: number; // ms
		numCopies?: number;
		spawnManaCost?: number;

		tooltip: Tooltip;
	}>[];
};

export interface Mob {
	id: number;
	sid: string;

	drops?: {
		baseChance: number;
		type: number; // base petal type
	}[];

	rarities: Partial<{
		exp?: number;
		tooltip: Tooltip;
	}>[];
};

export interface Talent {
	id: number;
	sid: string;

	cost: number;
	rarity: string;
	deps?: string[]; // sids
	tooltip?: TranslationArgument[];
};

export function findTranslation<T extends TranslationArgument[]>(tooltip: Tooltip, name: string) {
	return tooltip.find((translation) => translation[0] === name) as Translation<T> | undefined;
}

export function getRarity<T>(values: Array<Partial<T>>, index: number) {
	let result: Partial<T> = {};
	for (let i = 0; i <= index; i++) {
		const value = values[i]!;
		result = { ...result, ...value };
	}
	return result;
}