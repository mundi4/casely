import { execSync } from "child_process";
import { existsSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, createWriteStream } from "fs";
import path from "path";
const imported = await import('archiver');
const archiver = imported.default || imported;

function run(cmd: string, cwd?: string) {
	console.log(`[build] $ ${cmd}`);
	execSync(cmd, { stdio: "inherit", cwd });
}

const root = process.cwd();
const distDir = path.join(root, "dist");
const artifactsDir = path.join(root, "artifacts");

//
// 1. dist, artifacts 폴더 초기화
//
if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
mkdirSync(path.join(distDir, "server", "static"), { recursive: true });
mkdirSync(path.join(distDir, "extension"), { recursive: true });
if (existsSync(artifactsDir)) rmSync(artifactsDir, { recursive: true, force: true });
mkdirSync(artifactsDir, { recursive: true });

//
// 2. app 빌드 및 복사
//
run("npm install", path.join(root, "app"));
run("npm run build", path.join(root, "app"));
cpSync(path.join(root, "app", "dist"), path.join(distDir, "server", "static"), { recursive: true });

//
// 3. server 코드 복사: *.py, static, start.bat
//
import { readdirSync, statSync } from "fs";

// Copy all .py files
const serverDir = path.join(root, "server");
const pyFiles = readdirSync(serverDir).filter(f => f.endsWith(".py"));
for (const file of pyFiles) {
	const src = path.join(serverDir, file);
	cpSync(src, path.join(distDir, "server", file));
}

// Copy static directory (if exists)
const staticSrc = path.join(serverDir, "static");
if (existsSync(staticSrc) && statSync(staticSrc).isDirectory()) {
	cpSync(staticSrc, path.join(distDir, "server", "static"), { recursive: true });
}

// Copy start.bat (if exists)
const startBat = path.join(serverDir, "start.bat");
if (existsSync(startBat)) {
	cpSync(startBat, path.join(distDir, "server", "start.bat"));
}


// 4. extension 파일 복사 및 manifest 치환
const extSrc = path.join(root, "extension");
const extDist = path.join(distDir, "extension");
cpSync(extSrc, extDist, { recursive: true });

// manifest.json 치환
const secretsPath = path.join(root, "secrets.json");
const manifestPath = path.join(extDist, "manifest.json");
if (existsSync(secretsPath) && existsSync(manifestPath)) {
	const secrets = JSON.parse(readFileSync(secretsPath, "utf8"));
	let manifest = readFileSync(manifestPath, "utf8");
	if (secrets.ORIGIN_URL) {
	// __REPLACE_ME_ORIGIN__ 치환
	manifest = manifest.replace(/__REPLACE_ME_ORIGIN__/g, secrets.ORIGIN_URL);
	manifest = manifest.replaceAll("http://the.source.com",secrets.ORIGIN_URL)
	writeFileSync(manifestPath, manifest, "utf8");
	console.log(`[build] manifest.json의 origin을 secrets.json 값으로 치환 완료.`);
	} else {
		console.warn("[build] secrets.json에 ORIGIN_URL이 없습니다. manifest.json 치환을 건너뜁니다.");
	}
} else {
	console.warn("[build] secrets.json 또는 manifest.json이 존재하지 않습니다. manifest 치환을 건너뜁니다.");
}

console.log("\n[build] 모든 산출물이 dist/에 모였습니다.");



// 5. /dist 폴더 전체를 node-only zip(archiver) -> base64 인코딩 -> 1500줄씩 분할 저장
// 사내 메신저로 보내야 하는데... 텍스트만 보낼 수 있다. 2000줄까지는 힘들다.
(async () => {
	//const archiver = (await import('archiver')).default || (await import('archiver'));
	const OUT_DIR = path.join(artifactsDir, "base64");
	const ARCHIVE_NAME = "casely-bundle.zip";
	const zipPath = path.join(artifactsDir, ARCHIVE_NAME);
	const LINE_WIDTH = 64;
	const LINES_PER_PART = 1500;
	const BEGIN = "-----BEGIN TOTALLY LEGAL FILE-----";
	const END = "-----END TOTALLY LEGAL FILE-----";

	function ensureDir(d: string) {
		mkdirSync(d, { recursive: true });
	}

	ensureDir(OUT_DIR);

	console.log(`[build] (archiver) 압축 중: ${zipPath}`);
	if (!existsSync(distDir)) {
		console.error(`[build] dist 폴더가 존재하지 않습니다: ${distDir}`);
		process.exit(1);
	}
	await new Promise<void>((resolve, reject) => {
		const output = createWriteStream(zipPath);
		const archive = archiver("zip", { zlib: { level: 9 } });
		output.on("close", () => {
			console.log(`[build] zip 파일 생성 완료: ${zipPath} (${archive.pointer()} bytes)`);
			resolve();
		});
		archive.on("error", (err) => {
			console.error("[build] archiver error:", err);
			reject(err);
		});
		archive.pipe(output);
		archive.glob("**/*", {
			cwd: distDir,
		});
		archive.finalize();
	});

	// base64 encode
	console.log(`[build] base64 인코딩 중: ${zipPath}`);
	const b64 = readFileSync(zipPath).toString("base64");
	const bodyLines = [];
	for (let i = 0; i < b64.length; i += LINE_WIDTH) bodyLines.push(b64.slice(i, i + LINE_WIDTH));
	const parts = [];
	for (let i = 0; i < bodyLines.length; i += LINES_PER_PART) parts.push(bodyLines.slice(i, i + LINES_PER_PART));

	// 파트 파일 쓰기
	parts.forEach((arr, i) => {
		const idx = String(i + 1).padStart(4, "0");
		const isFirst = i === 0;
		const isLast = i === parts.length - 1;
		const lines = [
			isFirst ? BEGIN : null,
			...arr,
			isLast ? END : null
		].filter(Boolean);
		const content = lines.join("\r\n") + "\r\n";
	const out = path.join(OUT_DIR, `part-${idx}.txt`);
	writeFileSync(out, content, "utf8");
	console.log(`[build] base64 파트 저장: ${out}`);
	});
	console.log(`[build] base64 분할 저장 완료 (총 ${parts.length}개, certutil 호환)`);
})();
