import fs from 'fs';
import path from 'path';

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

export function filterCases() {
  const files = walkDir('./knowledge');
  const stats: Record<string, { kept: number, deleted: number }> = {};

  for (const file of files) {
    const category = path.basename(path.dirname(file));
    if (!stats[category]) stats[category] = { kept: 0, deleted: 0 };

    const content = fs.readFileSync(file, 'utf8');
    const hasSituation = content.includes('## SITUATION');
    const hasFacts = content.includes('## KEY FACTS');
    const hasOutcome = content.includes('## OUTCOME');
    const hasLessons = content.includes('## LESSONS EXTRACTED');
    
    const lengthValid = content.length >= 300;
    
    const insufficientCount = (content.match(/INSUFFICIENT DATA/g) || []).length;
    
    if (hasSituation && hasFacts && hasOutcome && hasLessons && lengthValid && insufficientCount <= 2) {
      stats[category].kept++;
    } else {
      fs.unlinkSync(file);
      stats[category].deleted++;
    }
  }

  for (const [cat, { kept, deleted }] of Object.entries(stats)) {
    console.log(`Category: ${cat} | Kept: ${kept} | Deleted: ${deleted}`);
  }
}

// Ignore if imported
if (process.argv[1].includes('filter-cases')) {
  filterCases();
}
