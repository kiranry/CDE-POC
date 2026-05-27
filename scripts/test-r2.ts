import { getFile, putFile } from "../src/lib/storage";

async function main() {
  const buf = Buffer.from("r2-test");
  await putFile("_test/r2-check.txt", buf, "text/plain");
  const back = await getFile("_test/r2-check.txt");
  console.log("R2 OK:", back.toString());
}

main().catch((err) => {
  console.error("R2 FAILED:", err);
  process.exit(1);
});
