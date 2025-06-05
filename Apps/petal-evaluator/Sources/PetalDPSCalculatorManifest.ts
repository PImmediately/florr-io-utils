export default class PetalDPSCalculatorManifest {

	public flowerTalentDuplicator = true;
	public flowerTalentReloadMultiplier = 0.1 * 5;
	public flowerTalentSummonerMultiplier = 1 + 0.07 * 8;
	public flowerTalentPoisonMultiplier = 1.8; // NOTE: not accurate possibility

	public flowerPetalRotation = 4.0/*[rad/s]*/;
	public flowerBaseLuck = 0.2 * 4;
	public flowerManaPerSecond = 0;

	public targetMOBSID: string | null = null;
	public targetMOBRarity: number | null = null;

	public maxLigntningBounces: number = Infinity;
	public touchedGlassEntityCount = 1.6;
	public touchedLaserEntityCount = 3;

}