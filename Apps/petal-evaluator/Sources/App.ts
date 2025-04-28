import path from "node:path"
import fs from "node:fs";

import type { Mob, Petal } from "./GameTypes";

import GameClient from "./GameClient";

import PetalsEvaluator from "./PetalsEvaluator";
import PetalsEvaluatorNormalAntHellActive from "./PetalsEvaluatorNormalAntHellActive";
import PetalsEvaluatorFireAntHellActive from "./PetalsEvaluatorFireAntHellActive";
import PetalsEvaluatorDesertDPS from "./PetalsEvaluatorDesertDPS";


(() => {
	const zoneDirPath = path.join(__dirname, "..", "zones");
	if (!fs.existsSync(zoneDirPath)) {
		fs.mkdirSync(zoneDirPath, { recursive: true });
	}

	const buildsDirPath = path.join(__dirname, "..", "..", "build-downloader", "builds");
	if (!fs.existsSync(buildsDirPath)) {
		console.error("Builds directory does not exist. Please run the build-downloader first.");
		return;
	}

	const gameClient = (() => {
		const latestVersionHashPath = path.join(buildsDirPath, "latest.txt");
		if (!fs.existsSync(latestVersionHashPath)) {
			console.error("Latest version hash file does not exist. Please run the build-downloader first.");
			return;
		}
		const latestVersionHash = fs.readFileSync(latestVersionHashPath, { encoding: "utf-8" });

		const buildDirPath = path.join(buildsDirPath, latestVersionHash);
		if (!fs.existsSync(buildDirPath)) {
			console.error("Build directory does not exist. Please run the build-downloader first.");
			return;
		}

		const mobsPath = path.join(buildDirPath, "util_mobs.json");
		if (!fs.existsSync(mobsPath)) {
			console.error("Mobs file does not exist.");
			return;
		}
		const mobs = JSON.parse(fs.readFileSync(mobsPath, { encoding: "utf-8" })) as Mob[];

		const petalsPath = path.join(buildDirPath, "util_petals.json");
		if (!fs.existsSync(petalsPath)) {
			console.error("Petals file does not exist.");
			return;
		}
		const petals = JSON.parse(fs.readFileSync(petalsPath, { encoding: "utf-8" })) as Petal[];

		return new GameClient(mobs, petals, []);
	})();
	if (!gameClient) return;

	const evaluators = new Set<PetalsEvaluator>();
	evaluators.add(new PetalsEvaluatorNormalAntHellActive(gameClient));
	evaluators.add(new PetalsEvaluatorFireAntHellActive(gameClient));
	evaluators.add(new PetalsEvaluatorDesertDPS(gameClient));

	evaluators.forEach((evaluator) => {
		const results = evaluator.evaluate();
		const text = evaluator.evaluationsToText(results);

		const filePath = path.join(zoneDirPath, `${evaluator.name}.txt`);
		fs.writeFileSync(filePath, text, { encoding: "utf-8" });
	});

})();