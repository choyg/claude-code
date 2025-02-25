import path from "path";
import { SourceMapConsumer } from "source-map";
import fs from "fs/promises";

async function extractSourceFiles(sourcemapJson, outputDir) {
  const consumer = await new SourceMapConsumer(sourcemapJson);

  const uniqueSources = [...new Set(consumer.sources)];

  for (const source of uniqueSources) {
    const sourceContent = consumer.sourceContentFor(source, true);
    if (sourceContent) {
      const outputFile = path.join(outputDir, source);
      const outputDirOfFile = path.dirname(outputFile);

      await fs.mkdir(outputDirOfFile, { recursive: true });
      await fs.writeFile(outputFile, sourceContent);

      console.log(`Extracted and wrote: ${outputFile}`);
    } else {
      console.warn(`No source content found for source: ${source}`);
    }
  }

  consumer.destroy();
  console.log("Finished processing sourcemap");
}

const jsmap = await fs.readFile("./claude.js", "utf-8");
await extractSourceFiles(JSON.parse(jsmap), "./claude/");
