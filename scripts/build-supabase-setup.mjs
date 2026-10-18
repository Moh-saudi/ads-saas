import { readdir, readFile, writeFile } from "node:fs/promises";
const dir = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const chunks = [];
for (const name of files) {
  const sql = await readFile(new URL(name, dir), "utf8");
  chunks.push(
    `-- SOURCE: ${name}\n${sql.replace(/^begin;\s*$/gim, "").replace(/^commit;\s*$/gim, "")}`,
  );
}
await writeFile(
  new URL("../supabase_setup.sql", import.meta.url),
  `-- Fresh database only. All migrations in one atomic transaction. Does not include demo seed.\nbegin;\n${chunks.join("\n\n")}\ncommit;\n`,
);
console.log(`Wrote supabase_setup.sql from ${files.length} migrations`);
