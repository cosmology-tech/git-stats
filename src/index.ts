import * as fs from 'fs';
import * as path from 'path';

import { MultiRepoAnalyzer } from "./multi";
import { cosmologyRepoUrls } from "./repos";
import { AnalysisResult } from "./types";

// Helper function to print analysis results
function printAnalysisResults(results: AnalysisResult): void {
  console.log('\n=== Repository Analysis Results ===\n');

  console.log('Repository Location:', results.repositoryPath);

  console.log('\nRepository Summary:');
  console.log(JSON.stringify(results.summary, null, 2));

  console.log('\nTop Contributors:');
  console.log(JSON.stringify(results.contributors.slice(0, 10), null, 2));

  console.log('\nRecent Commits:');
  console.log(JSON.stringify(results.recentCommits, null, 2));
}


interface TimestampedResult {
  timestamp: string;
  results: AnalysisResult[];
}

async function saveResults(results: AnalysisResult[]): Promise<void> {
  const timestamp = new Date().toISOString();
  const resultsDir = path.join(process.cwd(), 'results');
  
  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestampedResults: TimestampedResult = {
    timestamp,
    results
  };

  // Save with timestamp in filename
  const filename = path.join(resultsDir, `analysis-${timestamp.replace(/:/g, '-')}.json`);
  console.log(filename)
  fs.writeFileSync(
    filename,
    JSON.stringify(timestampedResults, null, 2)
  );

  console.log(`Results saved to: ${filename}`);
}


// Example usage
async function main() {
  try {
    const reposAnalyzer = new MultiRepoAnalyzer(cosmologyRepoUrls, 'temp');
    const results = await reposAnalyzer.analyzeAll();
    
    await saveResults(results);

    // for (const result of results) {
    //   printAnalysisResults(result);
    // }
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Run the analysis if called directly
if (require.main === module) {
  main();
}
